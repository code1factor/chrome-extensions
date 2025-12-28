const crx3 = require('crx3');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execSync } = require('child_process');

// Function to calculate extension ID from private key using openssl
function getExtensionId(privateKeyPath) {
    // Extract public key in DER format using openssl
    const pubKeyDer = execSync(
        `openssl rsa -in "${privateKeyPath}" -pubout -outform DER 2>/dev/null`,
        { encoding: 'buffer' }
    );

    const hash = crypto.createHash('sha256').update(pubKeyDer).digest('hex');
    // Take first 32 chars and convert to extension ID format (a-p)
    return hash.slice(0, 32).split('').map(c => {
        const num = parseInt(c, 16);
        return String.fromCharCode(97 + num); // 'a' + num
    }).join('');
}

async function buildExtension(name, srcDir, keyPath, outputDir, githubUser, repoName) {
    const extId = getExtensionId(keyPath);
    console.log(`\n=== Building ${name} ===`);
    console.log(`Extension ID: ${extId}`);

    // Create temp directory for modified extension
    const tempDir = path.join(outputDir, `${name}-temp`);
    if (fs.existsSync(tempDir)) {
        fs.rmSync(tempDir, { recursive: true });
    }

    // Copy extension files
    fs.cpSync(srcDir, tempDir, { recursive: true });

    // Update manifest.json with new update_url
    const manifestPath = path.join(tempDir, 'manifest.json');
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

    // Remove original key (we'll use our own)
    delete manifest.key;

    // Set update_url to GitHub Pages
    manifest.update_url = `https://${githubUser}.github.io/${repoName}/${name}/update.xml`;

    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
    console.log(`Updated manifest.json with update_url: ${manifest.update_url}`);

    // Build CRX
    const crxPath = path.join(outputDir, name, `${name}.crx`);
    const crxDir = path.dirname(crxPath);
    if (!fs.existsSync(crxDir)) {
        fs.mkdirSync(crxDir, { recursive: true });
    }

    await crx3([tempDir], {
        keyPath: keyPath,
        crxPath: crxPath
    });

    console.log(`Created: ${crxPath}`);

    // Create update.xml
    const updateXml = `<?xml version='1.0' encoding='UTF-8'?>
<gupdate xmlns='http://www.google.com/update2/response' protocol='2.0'>
  <app appid='${extId}'>
    <updatecheck codebase='https://${githubUser}.github.io/${repoName}/${name}/${name}.crx' version='${manifest.version}' />
  </app>
</gupdate>`;

    const updateXmlPath = path.join(outputDir, name, 'update.xml');
    fs.writeFileSync(updateXmlPath, updateXml);
    console.log(`Created: ${updateXmlPath}`);

    // Cleanup temp dir
    fs.rmSync(tempDir, { recursive: true });

    return { id: extId, version: manifest.version };
}

async function main() {
    // Configuration
    const githubUser = 'code1factor';
    const repoName = 'chrome-extensions';

    const baseDir = '/Users/user/Documents/chrome-extensions-host';
    const srcBase = '/Users/user/Documents/detox-extensions';

    const extensions = [
        { name: 'blocktube', src: path.join(srcBase, 'blocktube') },
        { name: 'stayfocusd', src: path.join(srcBase, 'stayfocusd') }
    ];

    const results = [];

    for (const ext of extensions) {
        const keyPath = path.join(baseDir, 'keys', `${ext.name}.pem`);
        const result = await buildExtension(
            ext.name,
            ext.src,
            keyPath,
            baseDir,
            githubUser,
            repoName
        );
        results.push({ ...ext, ...result });
    }

    console.log('\n=== Summary ===');
    console.log('Extension IDs for Chrome policy:');
    results.forEach(r => {
        console.log(`  ${r.name}: ${r.id} (v${r.version})`);
    });

    // Create policy template
    const policyTemplate = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>ExtensionInstallForcelist</key>
    <array>
${results.map(r => `        <string>${r.id};https://${githubUser}.github.io/${repoName}/${r.name}/update.xml</string>`).join('\n')}
    </array>
    <key>ExtensionInstallSources</key>
    <array>
        <string>https://${githubUser}.github.io/${repoName}/*</string>
    </array>
</dict>
</plist>`;

    const policyPath = path.join(baseDir, 'com.google.Chrome.plist');
    fs.writeFileSync(policyPath, policyTemplate);
    console.log(`\nCreated policy file: ${policyPath}`);

    // Create README for the repo
    const readme = `# Chrome Extensions Host

Self-hosted Chrome extensions with force-install policy.

## Extensions

| Extension | ID | Version |
|-----------|-----|---------|
${results.map(r => `| ${r.name} | \`${r.id}\` | ${r.version} |`).join('\n')}

## Installation

1. Enable GitHub Pages for this repository (Settings → Pages → Source: main branch)
2. Copy \`com.google.Chrome.plist\` to \`/Library/Managed Preferences/\`
3. Restart Chrome

\`\`\`bash
sudo cp com.google.Chrome.plist "/Library/Managed Preferences/"
sudo chmod 644 "/Library/Managed Preferences/com.google.Chrome.plist"
\`\`\`
`;

    fs.writeFileSync(path.join(baseDir, 'README.md'), readme);
    console.log('Created: README.md');
}

main().catch(console.error);
