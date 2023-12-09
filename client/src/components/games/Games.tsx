import { Routes, Route, Link } from "react-router-dom";
import TicTacToe from "../tictactoe/TicTacToe";
import Mastermind from "../mastermind/Mastermind";

const Games = () => {
    return (
        <div>
            <h2>Games</h2>
            <ul>
            <li>
              <Link to="/games/tictactoe">TicTacToe</Link>
            </li>
            <li>
              <Link to="/games/mastermind">Mastermind</Link>
            </li>
          </ul>
        </div>
    );
}

export default Games;