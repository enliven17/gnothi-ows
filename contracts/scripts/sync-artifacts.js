const fs = require("fs");
const path = require("path");

const artifactsPath = path.join(__dirname, "../artifacts/contracts");
const outputDirs = [
  path.join(__dirname, "../../frontend/lib/contracts"),
  path.join(__dirname, "../../frontend/src/lib/contracts"),
];

for (const outputDir of outputDirs) {
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
}

function syncContract(contractName, fileName) {
  const artifactPath = path.join(
    artifactsPath,
    fileName || `${contractName}.sol`,
    `${contractName}.json`
  );

  if (!fs.existsSync(artifactPath)) {
    console.log(`Artifact not found: ${contractName}`);
    return;
  }

  const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf8"));
  const contractData = {
    abi: artifact.abi,
    bytecode: artifact.bytecode,
    contractName,
  };

  for (const outputDir of outputDirs) {
    const outputPath = path.join(outputDir, `${contractName}.json`);
    fs.writeFileSync(outputPath, JSON.stringify(contractData, null, 2));
  }

  console.log(`Synced ${contractName} to frontend contract directories`);
}

console.log("Syncing contract artifacts to frontend...\n");

syncContract("BetCOFI");
syncContract("BetFactoryCOFI");

console.log("\nDone! Contract artifacts synced.");
