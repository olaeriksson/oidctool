const { EntraIdManifestImporter } = require('./entraid-manifest');

/**
 * Registry of available configuration importers.
 * Adding a new importer is as simple as registering an instance here.
 */
const IMPORTERS = [
  new EntraIdManifestImporter(),
];

/**
 * Get public list of available importers for UI dropdowns.
 */
function getAvailableImporters() {
  return IMPORTERS.map((imp) => ({
    id: imp.id,
    name: imp.name,
    description: imp.description,
    placeholder: imp.placeholder || '',
  }));
}

/**
 * Dispatch raw content to the specified importer by ID.
 * @param {string} importerId 
 * @param {string} rawText 
 */
function parseWithImporter(importerId, rawText) {
  const importer = IMPORTERS.find((imp) => imp.id === importerId);
  if (!importer) {
    throw new Error(`Importer "${importerId}" not found.`);
  }

  return importer.parse(rawText);
}

module.exports = {
  getAvailableImporters,
  parseWithImporter,
};
