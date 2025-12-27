// This script sets up HTTPS for the application using the ASP.NET Core HTTPS certificate
const fs = require('fs');
const { execSync } = require('child_process');
const path = require('path');

const baseFolder =
  process.env.APPDATA !== undefined && process.env.APPDATA !== ''
    ? `${process.env.APPDATA}/ASP.NET/https`
    : `${process.env.HOME}/.aspnet/https`;

const certificateArg = process.argv.map(arg => arg.match(/--name=(?<value>.+)/i)).filter(Boolean)[0];
const certificateName = certificateArg ? certificateArg.groups.value : "vueapp";

if (!certificateName) {
  console.error('Invalid certificate name. Run this script in the context of an npm/yarn script or pass --name=<<app>> explicitly.')
  process.exit(-1);
}

// Ensure the base folder exists
if (!fs.existsSync(baseFolder)) {
  fs.mkdirSync(baseFolder, { recursive: true });
}

const certFilePath = path.join(baseFolder, `${certificateName}.pem`);
const keyFilePath = path.join(baseFolder, `${certificateName}.key`);

if (!fs.existsSync(certFilePath) || !fs.existsSync(keyFilePath)) {
  // Export certificate as PEM (includes both cert and key in one file)
  const tempPemPath = path.join(baseFolder, `${certificateName}.temp.pem`);
  
  try {
    // Export certificate synchronously
    execSync(`dotnet dev-certs https --export-path "${tempPemPath}" --format Pem --no-password`, { stdio: 'inherit' });
    
    // Read the PEM file and split it into cert and key
    if (fs.existsSync(tempPemPath)) {
      const pemContent = fs.readFileSync(tempPemPath, 'utf8');
      
      // Extract certificate(s) and private key from PEM.
      // Note: some PEM exports include cert chains (multiple CERTIFICATE blocks).
      const certMatches = pemContent.match(/-----BEGIN CERTIFICATE-----[\s\S]*?-----END CERTIFICATE-----/g);
      const keyMatch = pemContent.match(/-----BEGIN (?:RSA |EC |ENCRYPTED )?PRIVATE KEY-----[\s\S]*?-----END (?:RSA |EC |ENCRYPTED )?PRIVATE KEY-----/);

      if (!certMatches || certMatches.length === 0) {
        throw new Error(
          `Failed to extract certificate block(s) from PEM export (${tempPemPath}). ` +
          `Unexpected PEM format. First bytes:\n${pemContent.slice(0, 200)}`
        );
      }
      if (!keyMatch) {
        throw new Error(
          `Failed to extract private key block from PEM export (${tempPemPath}). ` +
          `Unexpected PEM format. First bytes:\n${pemContent.slice(0, 200)}`
        );
      }

      fs.writeFileSync(certFilePath, certMatches.join('\n'));
      console.log(`✓ Certificate exported to ${certFilePath}`);

      fs.writeFileSync(keyFilePath, keyMatch[0]);
      console.log(`✓ Key exported to ${keyFilePath}`);

      // Validate output files were created and are non-empty
      const certOk = fs.existsSync(certFilePath) && fs.statSync(certFilePath).size > 0;
      const keyOk = fs.existsSync(keyFilePath) && fs.statSync(keyFilePath).size > 0;
      if (!certOk || !keyOk) {
        throw new Error(
          `Certificate export did not produce expected output files. ` +
          `certOk=${certOk}, keyOk=${keyOk}, cert=${certFilePath}, key=${keyFilePath}`
        );
      }
      
      // Clean up temp file
      if (fs.existsSync(tempPemPath)) fs.unlinkSync(tempPemPath);
    } else {
      console.error('Certificate file was not created');
      process.exit(1);
    }
  } catch (error) {
    console.error('Failed to export certificate:', error.message);
    // Best-effort cleanup
    try { if (fs.existsSync(tempPemPath)) fs.unlinkSync(tempPemPath); } catch (_) {}
    process.exit(1);
  }
} else {
  console.log('Certificate files already exist');
}