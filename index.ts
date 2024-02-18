import express from 'express';
import OpenAI from 'openai';
import dotenv from 'dotenv';
import cors from 'cors';

import { DeviceInterface } from 'magichome-core';
dotenv.config();

const deviceInterface = new DeviceInterface(process.env.OFFICE_LIGHT_IP as string);
let currlightState = [129, 35, 35, 49, 0, 0, 138, 43, 226, 50, 100, 0, 0, 15];
const openai = new OpenAI({
	organization: 'org-bk09CWfxrbtm1FOB2cqXq4Ra',
	apiKey: process.env.API_KEY,
});

interface IColorHSV {
	hue: number; //0-360
	saturation: number; //0-100
	value: number; //0-100
	isOn: boolean;
}

function sendToOpenAI(userInstruction: string) {
	openai.chat.completions
		.create({
			model: 'gpt-3.5-turbo-0125',
			messages: [
				{
					role: 'system',
					content: `
                Background:
                    You are given an array of ints: "lightState" where each element represents specific data about a light's state and device metadata in sequence:
                    [unused,controllerHardwareVersion,isOn = (35 ? true : false),unused,unused,unused,red,green,blue,warmWhite,controllerFirmwareVersion,coldWhite,unused,unused]

                User Intepretation:
                    The user will give instructions to change the light's state. 
                    On / Off:
                        If any color value (red,green,blue,warmWhite,coldWhite) is greater than 1, turn the light on.
                        Only turn light off if the user explicitly says to do so even if the color values are all 0.
                        If the user instructs to turn the light off do not change any of the color values unless the user also instructs to do so.
                    Color:
                        Changing colors:
                            If the user instructs to change or set the light *to* a specific color then do not keep other color values.
                            Keep in mind a user defined color name may represent multiple color values.
                    Brightness:
                        For the word "dim", "brighten" or any synonyms, adjust the output of each color value by the same percentage. Do not exceed or go below the maximum or minimum value for each color.
                Expected Output:
                    According to the user's instruction, respond with the following json: 
                    {'red': number [0-255],'green': number [0-255], 'blue': number [0-255], 'warmWhite': number [0-255], 'coldWhite': number [0-255], isOn: [0,1], updatedArr: lightState (where the updatedArr is the original lightState with the updated color values) }
                `,
				},
				{
					role: 'user',
					content: `
                    {
                        lightState: ${JSON.stringify(currlightState)},
                        userInstruction: ${userInstruction}
                    }`,
				},
			],
		})
		.then((response) => {
			const messageContent = response.choices[0].message.content as string;
			//convert messageContent to JSON
            console.log(messageContent)
            
			const messageContentJSON = JSON.parse(messageContent);
            console.log(messageContentJSON);
			const arr = messageContentJSON['updatedArr'];
            console.log(arr);
			deviceInterface.arrayToCommand(arr);
    
            currlightState = arr;
			// console.log(response.choices[0].message.content);
		})
		.catch((error) => {
			console.log(error);
		});
}


const app = express();
const PORT = 3000;

app.use(express.json());
app.use(cors()); // Enable CORS for all routes.

app.get('/api/light/setState', async (req, res) => {
	const { hue, saturation, value, isOn }: IColorHSV = req.body;
	console.log(hue, saturation, value, isOn);
});
app.post('/api/setColor', async (req, res) => {


	const { userInstruction } = req.body;


	res.send({
		message: 'Success',
	});

    sendToOpenAI(userInstruction);
});
app.listen(PORT, () => {
	console.log(`Server is running on http://localhost:${PORT}`);
});
