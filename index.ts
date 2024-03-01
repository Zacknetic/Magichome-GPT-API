import express from "express";
import { GptMagicHome } from "./GptMagicHome";
const app = express();
const PORT = 3000;
const gptMagicHome = new GptMagicHome(app, PORT);