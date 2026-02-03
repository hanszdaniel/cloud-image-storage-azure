const { app } = require('@azure/functions');
const { BlobServiceClient } = require('@azure/storage-blob');

const containerName = "images";

app.http('listimages', {
    methods: ['GET'],
    authLevel: 'anonymous',
    handler: async (request, context) => {
        try {
            const connStr =
                process.env.AzureWebJobsStorage || process.env.AZURE_STORAGE_CONNECTION_STRING;

            const service = BlobServiceClient.fromConnectionString(connStr);
            const container = service.getContainerClient(containerName);

            const images = [];
            for await (const blob of container.listBlobsFlat()) {
                const blobClient = container.getBlobClient(blob.name);

                images.push({
                    name: blob.name,
                    url: blobClient.url
                });
            }

            return {
                status: 200,
                jsonBody: images
            };

        } catch (err) {
            return {
                status: 500,
                jsonBody: { error: err.message }
            };
        }
    }
});
