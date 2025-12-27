const fs = require('fs')
const path = require('path')

const baseFolder =
  process.env.APPDATA !== undefined && process.env.APPDATA !== ''
    ? `${process.env.APPDATA}/ASP.NET/https`
    : `${process.env.HOME}/.aspnet/https`;

const certificateArg = process.argv.map(arg => arg.match(/--name=(?<value>.+)/i)).filter(Boolean)[0];
const certificateName = certificateArg ? certificateArg.groups.value : (process.env.npm_package_name || "vueapp");

if (!certificateName) {
  console.error('Invalid certificate name. Run this script in the context of an npm/yarn script or pass --name=<<app>> explicitly.')
  process.exit(-1);
}

const certFilePath = path.join(baseFolder, `${certificateName}.pem`);
const keyFilePath = path.join(baseFolder, `${certificateName}.key`);

const proxyDestination = 'https://localhost:29324/'

// Check if certificate files exist, if not, use HTTP instead
let httpsConfig = {};
if (fs.existsSync(certFilePath) && fs.existsSync(keyFilePath)) {
  httpsConfig = {
    key: fs.readFileSync(keyFilePath),
    cert: fs.readFileSync(certFilePath),
  };
} else {
  console.warn(`⚠️  Certificate files not found at ${baseFolder}. Using HTTP instead.`);
  console.warn(`   Run 'npm start' to generate certificates, or use HTTP by removing https config.`);
}

module.exports = {
  devServer: {
    ...(Object.keys(httpsConfig).length > 0 ? { https: httpsConfig } : {}),
    proxy: {
      '^/user': {
        target: proxyDestination
      },
      '^/vendor': {
        target: proxyDestination
      },
      '^/plant': {
        target: proxyDestination
      },
      '^/apiInfo': {
        target: proxyDestination
      },
    },
    port: 5002
  }
}
