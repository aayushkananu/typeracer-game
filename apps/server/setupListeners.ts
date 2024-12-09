import { Server } from "socket.io";
import { Game } from "./classes/game";

export const rooms = new Map<string, Game>();

export function setupListeners(io: Server) {
    io.on("connection", (socket) => {
        console.log(`New connection - ${socket.id}`);

        socket.on("join-game", (roomID: string, name: string) => {
            if(!roomID) return socket.emit("error", "Invalid room ID");
            if (!name) return socket.emit('error', "Please provide nickname.");
            
            socket.join(roomID);

            if(rooms.has(roomID)) {
                const game = rooms.get(roomID)
                if (!game) return socket.emit('error', 'Game not found');
                game.joinPlayer(socket.id, name, socket);
            } else {
                const game = new Game(roomID, io, socket.id)
                rooms.set(roomID, game)
                game.joinPlayer(socket.id, name, socket);
            }
            
        });
    });
}