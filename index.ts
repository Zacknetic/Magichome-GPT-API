import express from 'express';
import OpenAI from 'openai';
import dotenv from 'dotenv';
import cors from 'cors';

import { DeviceInterface } from 'magichome-core';
dotenv.config();
let instructionsSent = false;

const deviceInterface = new DeviceInterface(
	process.env.OFFICE_LIGHT_IP as string
);

let currlightStates = {
	lightStates: [
		{
			state: [35, 0, 0, 0, 0, 0, 22, 29],
			name: 'Ceiling Light',
			id: '001',
			room: 'office',
            hasCCT: true
		},
		{
			state: [35, 0, 0, 0, 0, 0, 48, 27],
			name: 'Window Light',
			id: '002',
			room: 'office',
            hasCCT: true
		},
		{
			state: [35, 0, 0, 0, 0, 0, 48, 27],
			name: 'Zacks Light',
			id: '003',
			room: 'bedroom',
            hasCCT: true
		},
		{
			state: [35, 0, 0, 0, 0, 0, 48, 27],
			name: 'Ceiling Light',
			id: '004',
			room: 'kitchen',
            hasCCT: true
		},
	],
	regions: [
		{
			name: 'second floor',
			rooms: ['office', 'bedroom'],
		},
		{
			name: 'first floor',
			rooms: ['kitchen'],
		},
	],
};

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

// async function sendToOpenAI(userInstruction: string) {
// 	return openai.chat.completions
// 		.create({
// 			model: 'gpt-3.5-turbo-0125',
// 			messages: [
// 				{
// 					role: 'system',
// 					content: `
//     Background:
//         You are given an array of ints: "lightState", where each element represents specific data about a light's state and device metadata in sequence:
//         [unused, controllerHardwareVersion, isOn = (35 ? true : false), unused, unused, unused, red, green, blue, warmWhite, controllerFirmwareVersion, coldWhite, unused, unused]

//     User Interpretation:
//         The user will give instructions to change the light's state.
//         On / Off:
//             If any color value (red, green, blue, warmWhite, coldWhite) is greater than 1, turn the light on.
//             Only turn light off if the user explicitly says to do so, even if the color values are all 0.
//             If the user instructs to turn the light off, do not change any of the color values unless the user also instructs to do so.
//         Color:
//             Changing colors:
//                 If the user instructs to change or set the light to a specific color, then do not keep other color values.
//                 Keep in mind a user-defined color name may represent multiple color values.
//                 If the user instructs to "add" or "increase" a color, keep all other color values the same and only adjust the specified color value.
//                     If not specified, assume the user wants to add or increase the color value by 20%.
//         Brightness:
//             For the word "dim", "brighten", or any synonyms, adjust the output of each color value by the same percentage. Do not exceed or go below the maximum or minimum value for each color.

//     Expected Output:
//         According to the user's instruction, respond with the following JSON:
//         {"red": number [0-255], "green": number [0-255], "blue": number [0-255], "warmWhite": number [0-255], "coldWhite": number [0-255], "isOn": [0,1], "updatedArr": lightState (where "updatedArr" is the original lightState with the updated color values)}
//     `,
// 				},
// 				{
// 					role: 'user',
// 					content: `{
//                     "lightState": ${JSON.stringify(currlightState)},
//                     "userInstruction": "${userInstruction}"
//                 }`,
// 				},
// 			],
// 		})
// 		.then(async (response) => {
// 			const messageContent = response.choices[0].message.content as string;

// 			const messageContentJSON = await JSON.parse(messageContent);
// 			console.log(messageContentJSON);
// 			const arr = messageContentJSON['updatedArr'];
// 			deviceInterface.arrayToCommand(arr);
// 			currlightState = arr;
// 			return messageContentJSON;
// 		})
// 		.catch((error) => {
// 			console.log(error);
// 		});
// }

async function sendToOpenAI(userInstruction: string) {
	// Determine messages to send based on whether instructions have been sent

	// Update the flag to true after the first call

	// Send the messages to OpenAI
	return openai.chat.completions
		.create({
			model: 'gpt-3.5-turbo-0125',
			messages: [
				// If instructions haven't been sent, include both the system and user's message
				{
					role: 'system',
					content: `
        Background:
            You are provided a JSON object with the following structure:
                - lightStates: an array of objects representing the state of each light in the user's home. Each object contains the following properties:
                    - state: an array of 8 integers representing the light's state and device metadata in sequence as follows:
                        [isOn, red, green, blue, warmWhite, coldWhite, controllerHardwareVersion, controllerFirmwareVersion]
                    - name: a string representing the name of the light. The user will refer to the light by this name.
                    - id: a string representing the light's unique identifier. You will use this to identify the light in the response.
                    - room: a string representing the room where the light is located.
                - regions: an array of objects representing the regions of the user's home. Use regions to which groups of lights are affected by the user's instructions.
                    If the user's instruction affects a region, the response should include the updated state of all lights in that region.
                Each region object contains the following properties:
                    - name: a string representing the name of the region.
                    - rooms: an array of strings representing the rooms in the region.
            If a user does not speciify a region, room, or light by name, assume the user is referring to all lights in the lightStates array in every room and region.

        User Interpretation:
            The user will give instructions to change the state of a region, room, or light. They may not refer to a specific name but a similar name or description.
            isOn:
                Complex scenarios:
                    If any color value (red, green, blue, warmWhite, coldWhite) is greater than 1, turn the light on.
                    Only turn light off if the user explicitly says to do so, even if the color values are all 0.
                    If the user instructs to turn the light off, do not change any of the color values unless the user also instructs to do so.
                Values: Be sure to output the new isOn state of the light as 35 or 70 in the response.
                    35: on
                    70: off
            Color:
                Changing colors
                    Actions:
                        Set:
                            If the user instructs to change or set the light *to* a specific color, then do not keep other color values.
                            Keep in mind a user-defined color name may represent multiple color values.
                        Add:
                            If the user instructs to "add" or "increase" a color, keep all other color values the same and only adjust the specified color value.
                            If not specified, assume the user wants to add or increase the color value by 25%.
                        "Too Dark" or "Too Bright": The user will use these phrases or similar to indicate the light is too dark or too bright.
                            "Too Dark":
                                If any color value is greater than 1, multiply that color value by 2 or add 100, whichever is greater.
                                If all color values are 0:
                                    If the light "hasCCT"
                                        set the warmWhite value to 200
                                    If the light does not "hasCCT"
                                        set red, green, and blue to 200
                            "Too Bright":
                                If any color value is greater than 1, divide that color value by 2 or subtract 50, whichever is greater.
                    Notes:
                        Lights can have up to 5 color types: red, green, blue, warmWhite, and coldWhite. Keep that in mind when interpreting the user's instructions.
                        It is possible that the user will refer to "white" as a color. In this case, look at the current state of the light to determine if the user is referring to warmWhite, coldWhite, or both.
            Brightness:
                For the word "dim", "brighten", or any synonyms, adjust the output of each color value by the same percentage. Do not exceed the maximum or go below the minimum value for any color.
        
        Expected Output:
            According to the user's instruction, respond with the following JSON for each of the lights where a change has been made. Do not include lights where no change has been made: 
            [
                {
                    "state": state (where "state" is the original state with the updated color and isOn values)
                    "name": name (where "name" is the original name)
                    "id": id (where "id" is the original id),
                    "room": room (where "room" is the original room)
                }
            ]       
        `,
					// Your initial instructions here
				},
				{
					role: 'user',
					content: `{
                        "lightStates": ${JSON.stringify(currlightStates)},
                        "userInstruction": "${userInstruction}"
                    }`,
				},
			],
		})
		.then(async (response) => {
			const messageContent = response.choices[0].message.content as string;
			const messageContentJSON = await JSON.parse(messageContent);
			console.log(messageContentJSON);
			const arr = messageContentJSON['updatedArr'];
			// deviceInterface.arrayToCommand(arr);
			currlightStates.lightStates = arr;
			instructionsSent = true;
			return messageContentJSON;
		})
		.catch((error) => {
			console.log(error);
		});
}

const app = express();
const PORT = 3000;

app.use(express.json());
app.use(cors()); // Enable CORS for all routes.

app.post('/api/setColor', (req, res) => {
	const { userInstruction } = req.body;

	sendToOpenAI(userInstruction)
		.then((response) => {
			console.log('returning response', response);
			res.send({
				message: 'Success',
				data: response, // Send the actual response data
			});
		})
		.catch((error) => {
			console.error('Error processing request', error);
			res.status(500).send({
				message: 'An error occurred',
			});
		});
});
app.listen(PORT, () => {
	console.log(`Server is running on http://localhost:${PORT}`);
});
