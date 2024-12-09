import { emit } from "process";
import { Server, Socket } from "socket.io";
import { rooms } from "../setupListeners";
import { generateParagraph } from "../utils/generateParagraph";

export class Game {
    gameStatus: "not-started" | "in-progress" | "finished";
    gameID: string;
    players: {id: string; score: number; name: string }[]
    io: Server;
    gameHost: string;
    paragraph: string; 

    constructor(id: string, io: Server, host: string) {
        this.gameID = id;
        this.players = [];
        this.io = io;
        this.gameHost = host;
        this.gameStatus = "not-started";
        this.paragraph = "";
    }

    setupListeners(socket: Socket) {
        socket.on('start-game', async () => {
            if (this.gameStatus === 'in-progress') 
                return socket.emit("error", "The game has already started");
                
            if (this.gameHost !== socket.id)
                return socket.emit("error",
                "You are not the host of the game. Only the host can start the game."
                );

            for (const player of this.players) {
                player.score = 0;
            }
            this.io.to(this.gameID).emit('players', this.players);

            this.gameStatus = 'in-progress';

            const paragraph = await generateParagraph();
            this.paragraph = paragraph;
            this.io.to(this.gameID).emit('game-started', paragraph);

            setTimeout(() => {
                this.gameStatus = 'finished';
                this.io.to(this.gameID).emit('game-finished');
                this.io.to(this.gameID).emit("players", this.players);
            }, 60000);

        });

        socket.on('player-typed', (typed: string) => {
            if(this.gameStatus !== 'in-progress')
                return socket.emit("error", "The game has not started yet");

            const splittedParagraph = this.paragraph.split(" ");
            const splittedTyped = typed.split(" ");

            let score = 0;

            for (let i = 0; i < splittedTyped.length; i++) {
                if (splittedTyped[i] === splittedParagraph[i]) {
                    score++;
                } else {
                    break;
                }
            }

            const player = this.players.find(player => player.id === socket.id);

            if(player) player.score = score;

            this.io.to(this.gameID).emit('player-score', {id: socket.id, score })
        });

        socket.on('leave', () => {
            if(socket.id === this.gameHost) {
                this.players = this.players.filter((player) => player.id !== socket.id);

                if(this.players.length!== 0) {
                    this.gameHost = this.players[0].id;
                } else {
                    rooms.delete(this.gameID)
                }

            }

            socket.leave(this.gameID);
            this.players = this.players.filter((player) => player.id !== socket.id);
            this.io.to(this.gameID).emit("player-left", socket.id);
        })
    }

    joinPlayer(id: string, name: string, socket: Socket) {
        if (this.gameStatus === 'in-progress') 
        return socket.emit(
            'error',
            "Game already started, please wait for it to end before joining."
            );

        this.players.push({id, name, score: 0});
        this.io.to(this.gameID).emit('player-joined', {
            id, name, score: 0
        });

        socket.emit('player', this.players);
        socket.emit('new-host', this.gameHost);

        this.setupListeners(socket);
    }
}