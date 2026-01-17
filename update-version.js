
const fs = require("fs");

const packageJson = JSON.parse(fs.readFileSync("package.json", "utf8"));
const version = packageJson.version;

const updateFile = (path) => {
    const data = JSON.parse(fs.readFileSync(path, "utf8"));
    data.version = version;
    fs.writeFileSync(path, JSON.stringify(data, null, 2));
};

updateFile("module.json");
updateFile("manifest.json");

console.log(`Updated module + manifest to v${version}`);