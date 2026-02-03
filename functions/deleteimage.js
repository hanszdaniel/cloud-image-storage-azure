const { app } = require("@azure/functions");
const { BlobServiceClient } = require("@azure/storage-blob");
const { TableClient, AzureNamedKeyCredential } = require("@azure/data-tables");

const containerName = "images";
const tableName = "imagetable";

app.http("deleteimage", {
  methods: ["POST"],
  authLevel: "anonymous",
  handler: async (req, context) => {
    try {
      const body = await req.json();
      const { fileName } = body;

      if (!fileName) {
        return {
          status: 400,
          jsonBody: { error: "Missing fileName" }
        };
      }

      // ---- Delete Blob ----
      const connStr =
        process.env.AzureWebJobsStorage ||
        process.env.AZURE_STORAGE_CONNECTION_STRING;

      const blobServiceClient =
        BlobServiceClient.fromConnectionString(connStr);

      const containerClient =
        blobServiceClient.getContainerClient(containerName);

      const blobClient =
        containerClient.getBlockBlobClient(fileName);

      await blobClient.deleteIfExists();

      // ---- Delete Table Metadata ----
      const accountName = process.env.AZURE_STORAGE_ACCOUNTNAME;
      const accountKey = process.env.AZURE_STORAGE_ACCOUNTKEY;

      const credential =
        new AzureNamedKeyCredential(accountName, accountKey);

      const tableClient = new TableClient(
        `https://${accountName}.table.core.windows.net`,
        tableName,
        credential
      );

      try {
  await tableClient.deleteEntity("images", fileName);
} catch (err) {
  context.log("Table entity not found, skipping delete");
}


      return {
        status: 200,
        jsonBody: { message: "Image deleted successfully" }
      };

    } catch (err) {
      context.log("DELETE ERROR:", err);
      return {
        status: 500,
        jsonBody: { error: err.message }
      };
    }
  }
});
