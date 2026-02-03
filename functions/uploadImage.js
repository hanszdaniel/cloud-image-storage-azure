const { app } = require('@azure/functions');
const { BlobServiceClient } = require('@azure/storage-blob');
const { TableClient, AzureNamedKeyCredential } = require("@azure/data-tables");

const containerName = 'images';
const tableName = "imagetable";

async function getContainerClient() {
    const connStr =
        process.env.AZURE_STORAGE_CONNECTION_STRING ||
        process.env.AzureWebJobsStorage;

    if (!connStr || connStr.trim() === "") {
        throw new Error("Azure Storage connection string is missing");
    }

    const blobServiceClient = BlobServiceClient.fromConnectionString(connStr);
    const containerClient = blobServiceClient.getContainerClient(containerName);
    await containerClient.createIfNotExists({ access: "blob" });

    return containerClient;
}

app.http("uploadimage", {
    methods: ["POST"],
    authLevel: "anonymous",
    handler: async (req, context) => {
        try {
            // ✅ READ JSON BODY
            const body = await req.json();
            const { fileName, image } = body;

            if (!fileName || !image) {
                return {
                    status: 400,
                    jsonBody: { error: "Missing fileName or image data" }
                };
            }

            // ✅ Convert Base64 → Buffer
            const buffer = Buffer.from(image, "base64");

            // -------------------------
            // UPLOAD TO BLOB STORAGE
            // -------------------------
            const containerClient = await getContainerClient();
            const safeFileName = `img-${Date.now()}-${fileName}`;
            const blobClient = containerClient.getBlockBlobClient(safeFileName);

            await blobClient.uploadData(buffer, {
                blobHTTPHeaders: { blobContentType: "image/png" }
            });

            const imageUrl = blobClient.url;

            // -------------------------
            // SAVE METADATA INTO TABLE
            // -------------------------
            const accountName = process.env.AZURE_STORAGE_ACCOUNTNAME;
            const accountKey = process.env.AZURE_STORAGE_ACCOUNTKEY;

            if (!accountName || !accountKey) {
                throw new Error("Missing Table Storage credentials");
            }

            const credential = new AzureNamedKeyCredential(accountName, accountKey);
            const tableClient = new TableClient(
                `https://${accountName}.table.core.windows.net`,
                tableName,
                credential
            );

            await tableClient.createEntity({
                partitionKey: "images",
                rowKey: safeFileName,
                fileName: safeFileName,
                url: imageUrl,
                uploadedOn: new Date().toISOString()
            });

            return {
                status: 200,
                jsonBody: {
                    message: "Image uploaded successfully",
                    fileName: safeFileName,
                    url: imageUrl
                }
            };

        } catch (err) {
            context.log("UPLOAD ERROR:", err);
            return {
                status: 500,
                jsonBody: { error: err.message }
            };
        }
    }
});
