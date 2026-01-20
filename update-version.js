
const fs = require("fs");

const packageJson = JSON.parse(fs.readFileSync("package.json", "utf8"));
const version = packageJson.version;

const updateFile = (path) => {
    const data = JSON.parse(fs.readFileSync(path, "utf8"));

    //update version
    data.version = version;

    // Update download URL (if present)
    if (data.download) {
    data.download = `https://github.com/Starleaigh/red-thread/archive/refs/tags/v${version}.zip`;
    }

    // Update manifest URL (if present)
    if (data.manifest) {
    data.manifest = `https://raw.githubusercontent.com/Starleaigh/red-thread/main/manifest.json`;
    }
 
    fs.writeFileSync(path, JSON.stringify(data, null, 2));
};

updateFile("system.json");
updateFile("manifest.json");

console.log(`Updated system + manifest to v${version}`);