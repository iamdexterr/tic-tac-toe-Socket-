✅ Username
✅ Unique username
✅ Matchmaking
✅ Socket.IO rooms
✅ Server-authoritative game
✅ Turn validation
✅ Win/draw
✅ Disconnect
✅ New Game

⬜ Game history + PostgreSQL
⬜ Spectators
⬜ Reconnection
⬜ Redis / multiple servers
⬜ More advanced Socket.IO concepts

Client → Server

find_match
cancel_matchmaking
make_move
watch_game
leave_game
request_rematch
chat_message

Server → Client

match_found
game_state
move_made
game_over
player_disconnected
live_games
error
rematch_started
chat_message
