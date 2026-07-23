import http from "node:http";

import { config } from "./config.js";
import { commerceRouter } from "./router.js";

const server = http.createServer((request, response) => {
    commerceRouter(request, response).catch((error) => {
        response.writeHead(500, {
            "content-type": "application/json"
        });
        response.end(JSON.stringify({
            status: "error",
            message: error.message
        }));
    });
});

server.listen(config.port, () => {
    console.log(`Aurora Commerce API listening on ${config.port}`);
    console.log("Support Gateway Ready");
});
