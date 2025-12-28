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
  // Use PFX format which includes the private key, then convert to PEM
  const tempPfxPath = path.join(baseFolder, `${certificateName}.temp.pfx`);
  const tempPemPath = path.join(baseFolder, `${certificateName}.temp.pem`);
  
  // Clean up any existing temp files first
  [tempPfxPath, tempPemPath].forEach(tempPath => {
    if (fs.existsSync(tempPath)) {
      try {
        fs.unlinkSync(tempPath);
      } catch (_) {}
    }
  });
  
  try {
    console.log('Exporting HTTPS certificate...');
    
    // Export as PFX (includes private key on Windows)
    execSync(`dotnet dev-certs https --export-path "${tempPfxPath}" --format Pfx --no-password`, { stdio: 'inherit' });
    
    if (!fs.existsSync(tempPfxPath)) {
      throw new Error('PFX certificate file was not created');
    }
    
    // Check if OpenSSL is available to convert PFX to PEM
    let opensslAvailable = false;
    try {
      execSync('openssl version', { stdio: 'pipe' });
      opensslAvailable = true;
    } catch (_) {
      // OpenSSL not available, will use alternative method
    }
    
    if (opensslAvailable) {
      // Use OpenSSL to convert PFX to PEM with separate cert and key
      console.log('Converting certificate to PEM format...');
      execSync(`openssl pkcs12 -in "${tempPfxPath}" -out "${tempPemPath}" -nodes -nocerts`, { stdio: 'inherit' });
      const keyContent = fs.readFileSync(tempPemPath, 'utf8');
      fs.writeFileSync(keyFilePath, keyContent);
      
      execSync(`openssl pkcs12 -in "${tempPfxPath}" -out "${tempPemPath}" -nodes -nokeys -clcerts`, { stdio: 'inherit' });
      const certContent = fs.readFileSync(tempPemPath, 'utf8');
      fs.writeFileSync(certFilePath, certContent);
      
      console.log(`✓ Certificate exported to ${certFilePath}`);
      console.log(`✓ Key exported to ${keyFilePath}`);
    } else {
      // OpenSSL not available - skip HTTPS setup
      // vue.config.js will automatically fall back to HTTP
      console.warn('⚠️  OpenSSL not found. Skipping HTTPS certificate setup.');
      console.warn('   The Vue dev server will use HTTP instead of HTTPS (acceptable for development).');
      console.warn('   To enable HTTPS, install OpenSSL:');
      console.warn('   - Download from https://slproweb.com/products/Win32OpenSSL.html');
      console.warn('   - Or use Chocolatey: choco install openssl');
      console.warn('   - Or use WSL: openssl is pre-installed');
      // Don't throw - allow dev server to start with HTTP fallback
    }

    // Validate output files were created and are non-empty
    const certOk = fs.existsSync(certFilePath) && fs.statSync(certFilePath).size > 0;
    const keyOk = fs.existsSync(keyFilePath) && fs.statSync(keyFilePath).size > 0;
    if (!certOk || !keyOk) {
      throw new Error(
        `Certificate export did not produce expected output files. ` +
        `certOk=${certOk}, keyOk=${keyOk}, cert=${certFilePath}, key=${keyFilePath}`
      );
    }
    
    // Clean up temp files
    [tempPfxPath, tempPemPath].forEach(tempPath => {
      if (fs.existsSync(tempPath)) {
        try {
          fs.unlinkSync(tempPath);
        } catch (_) {}
      }
    });
  } catch (error) {
    console.warn('⚠️  Certificate export failed:', error.message);
    // Best-effort cleanup
    [tempPfxPath, tempPemPath].forEach(tempPath => {
      try { if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath); } catch (_) {}
    });
    console.warn('   The Vue dev server will use HTTP instead of HTTPS (acceptable for development).');
    console.warn('   The backend API will still use HTTPS.');
    // Don't exit with error - let Vue dev server start with HTTP fallback
    // Exit with success code (0) so npm start continues
  }
} else {
  console.log('A valid HTTPS certificate is already present.');
}