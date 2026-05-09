import * as signalR from "@microsoft/signalr";

export const createSignalRConnection = (token) => {
    // La URL debe ser la de tu API Gateway (según el plan de Emilio)
    // Por ahora usamos una URL de ejemplo
    const connection = new signalR.HubConnectionBuilder()
        .withUrl("http://localhost:5000/hubs/alerts", {
            accessTokenFactory: () => token // Aquí enviamos el token de la TA-05.2
        })
        .withAutomaticReconnect() // Se reconecta solo si falla el internet
        .build();

    return connection;
};