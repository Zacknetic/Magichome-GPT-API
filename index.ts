import express from 'express';
import OpenAI from 'openai';
import dotenv from 'dotenv';
import cors from 'cors';

import { ControllerGenerator } from 'magichome-platform';
dotenv.config();
let currlightStates = {
	lightStates: [],
	regions: [
		{
			name: 'second floor',
			rooms: ['office', 'bedroom'],
		},
		{
			name: 'first floor',
			rooms: ['test room'],
		},
	],
};
const controllerGenerator = new ControllerGenerator();

let controllers = new Map<string, any>();
function init() {
	setupControllers().then((lightStates) => {
		currlightStates.lightStates = lightStates;
		console.log('lightStates', JSON.stringify(currlightStates));
		startServer();
	});
}

async function setupControllers() {
	controllers = await controllerGenerator.discoverCompleteControllers();

	const lightStates = controllerGenerator.controllerListToSimpleList(
		controllers
	) as any;
	return lightStates;
}

init();

console.log(JSON.stringify(currlightStates));

const openai = new OpenAI({
	organization: 'org-bk09CWfxrbtm1FOB2cqXq4Ra',
	apiKey: process.env.API_KEY,
});

/*

                 Background Information:

    Objective: Carefully interpret lighting control instructions. Ensure responses accurately reflect changes for lights in specified rooms or regions. Avoid assumptions and maintain precision.
    Data Structure:
        lightStates: Array of light objects, each with:
            state: Array of 6 integers (isOn, red, green, blue, warmWhite, coldWhite).
            name: Light's name.
            id: Light's unique identifier.
            room: Room location.
        regions: Array of region objects, each with:
            name: Region's name.
            rooms: Array of rooms in the region.

User Instruction Handling:

    Interpret instructions for changing light states in rooms or regions.
    Apply changes to all lights within the specified scope.
    Handle instructions based on keywords and context.

Specific Instructions:

    isOn:
        Turn on if any color value is > 1.
        Turn off only if explicitly stated.
        Output isOn as 35 (on) or 70 (off).
    Color:
        Set: Change to a specific color, removing other colors.
        Add: Adjust a color value, keeping others constant.
        Brightness Adjustments: Handle "Too Dark" or "Too Bright" instructions.
        CCT: Listen for "warm white". If so, set the warmWhite (the 5th integer in the array) value. Do not use the RGB values or coldWhite in this instance!
    Brightness:
        Adjust all colors uniformly based on "dim" or "brighten" instructions.

Expected Output:

    Respond with a JSON array of light objects reflecting the updated state, including all lights affected by the instruction, regardless of state change.

Example Output Structure:

json

// [
//   {
//     "state": [/* Updated state array */ //],
//     "name": "Light Name",
//     "id": "Light ID",
//     "room": "Room Name"
//   }
// ]

async function sendToOpenAI(userInstruction: string) {
	// Determine messages to send based on whether instructions have been sent
	// Update the flag to true after the first call

	// Send the messages to OpenAI
	return openai.chat.completions
		.create({
			model: 'gpt-3.5-turbo-0125',
			// temperature: 0,
			messages: [
				// If instructions haven't been sent, include both the system and user's message
				{
					role: 'system',
					content: `                 
Objective:
You are tasked with interpreting instructions for smart home lighting control, focusing on adjusting the color and state of lights based on specific user requests. Your response must be a detailed JSON object that not only outlines the changes to each light but also includes any necessary explanations or rationale for these changes.

Input Data Structure:

    Light States: An array of light objects, each with:
        A state array containing six integers with a range between 0 - 255 (isOn, red, green, blue, warmWhite, coldWhite).
        A name identifying the light.
        An id identifying the light.
        A room identifying the light's location.
    Regions: An array of region objects, each with:
        A name identifying the region.
        An array of rooms within the region.

Instructions for Model:

    All-Inclusive Light Adjustment: When processing an instruction, it is imperative that you apply the changes to every single light mentioned in the initial count. If the instruction involves changing colors, ensure that every light is accounted for in the lightStates array, with no light left unchanged unless specified by the instruction.

    Explicit Distribution and Grouping: For instructions involving multiple colors or distribution patterns (e.g., "one color per light", "all lights to the color of the ocean"), explicitly organize the lights into groups as instructed, ensuring that:
        Each color specified forms exactly one group, with no duplicate groups for the same color.
        All lights are included in the distribution, following the user's instructions for equal distribution or specific patterns.
        If equal distribution is requested, ensure that the lights are divided as evenly as possible among the colors, with any remainder lights grouped according to the user's preference.
        A light can only belong to one group.

    JSON Format for Responses: Structure your responses in JSON, including:
        An instructionInterpretation section summarizing the user's request.
        An explanation providing rationale behind the grouping or color assignment.
        A logic section detailing the approach taken to implement the instruction.
        The lightStates array, with each entry detailing the state changes for groups of lights or individual lights, adhering to the distribution rules.

Instructions for Model:

    Format All Responses in JSON: When providing explanations, clarifications, or any form of response, encapsulate your text within a JSON structure. This includes:
        The instruction interpretation.
        The logic or reasoning behind the grouping or color assignment.
        The final state of each light or group of lights after applying the instructions.

    Use Specific JSON Keys for Textual Information: For any explanatory text, use designated keys: "explanation" and "logic". This will allow for easy parsing and understanding of the response structure.
    Each color object is constructed of "state", "idList", and "colorName" keys. The "state" key contains an array of 6 integers, the "idList" key contains an array of light IDs, and the "colorName" key contains the name of the color.

Output JSON Example:

{
  "lightStates": [
    {
      "state": [35, 0, 102, 204, 0, 0],
      "idList": ["ABC123", "DEF456", "HIJ789", "KLM012", "NOP345"],
      "colorName: "ocean"
    }
    {
        "state": [35, 0, 102, 204, 0, 0],
        "idList": ["QRS678", "TUV901", "WXY234", "ZAB567", "CDE890"],
        "colorName: "mars"
      }
      {
        "state": [35, 0, 102, 204, 0, 0],
        "idList": ["FGH123", "IJK456", "LMN789", "OPQ012", "RST345", "UVW678"]
        "colorName: "frog"
      }
    "requestedChangedStatesCount": 16,
    "responseLightStatesCount": 16
  ],
  "instructionInterpretation": "The user wants three lights to be set to the color of the ocean.",
  "explanation": "All 3 lights have been grouped according to the color of the ocean...",
  "logic": "Given the instruction to set all lights to a single color, each light's state was adjusted accordingly...",
  groupLogic: {
    "totalLights": 16,
    "totalGroups": 3,
    "modulus": 1,
    "grouping": [5,5,6,
    "reasoning": "The lights were divided into 3 groups. The number of lights per group was calculated by dividing the total lights (16) by the number of colors specified (3) and adding the modulus (1) to the final color."
  }
}

Clarification on Handling Colors and Groups:
    Ensure it is clear that each color must result in only one group and that the distribution must cover all lights, either equally among the colors or as per any specific pattern requested. 
    It is crucial to reiterate the expectation that the responseLightStatesCount should reflect the actual number of lights modified, ensuring completeness of the response. 
    `,

					// Your initial instructions here
				},
				{
					role: 'user',
					content: `{
                        "homeInformation": ${JSON.stringify(currlightStates)},
                        "userInstruction": "${userInstruction}",
                        "totalLights": ${controllers.size}
                    }`,
				},
			],
		})
		.then(async (response) => {
			const messageContent = response.choices[0].message.content as string;
			console.log('messageContent', messageContent);
			const messageContentJSON = await parseJSONLeniently(messageContent);

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

app.get('/api/test', async (req, res) => {
	// const simpleControllers = await setupControllers();
	// res.send(JSON.stringify(simpleControllers));
	res.send('works');
});

app.get('/api/getLights', async (req, res) => {
	const simpleControllers = await setupControllers();
	res.send(JSON.stringify(simpleControllers));

	// res.send("works")
});
app.get('/api/setColor/:userInstruction', (req, res) => {
	const { userInstruction } = req.params;
	console.log('userInstruction', userInstruction);
	sendToOpenAI(userInstruction)
		.then((response) => {
			if (response) {
				console.log('returning response', response.lightStates);
				response.lightStates.forEach((group: any) => {
					group.idList.forEach((lightId: string) => {
						const controller = controllers.get(lightId);
						if (controller) {
							const arr = group.state;
							// console.log('arr', arr);
							controller.setArrayValues(arr);
						}
					});
				});
				return response;
			}
		})
		.then(async (respose) => {
			// Generate HTML content with the JSON response
			const htmlResponse = `
    <!DOCTYPE html>
    <html>
    <head>
        <title>Set Color Response</title>
    </head>
    <body>
        <h1>Color Set</h1>
        <p>${JSON.stringify(respose.instructionInterpretation)}</p>
        
        <pre>${JSON.stringify(
					respose.logic.reasoning
				)}</pre> <!-- Display the JSON response here -->

        <pre>${JSON.stringify(respose.lightStates)}</pre> <!-- Display the JSON response here -->
    </body>
    </html>
    `;
			res.send(htmlResponse);
			new Promise((resolve) => {
				setTimeout(async () => {
					await setupControllers().then((lightStates) => {
						currlightStates.lightStates = lightStates;
						// console.log('lightStates', JSON.stringify(currlightStates));
					});
				}, 5000);
			});
		})
		.catch((error) => {
			console.error('Error processing request', error);
			res.status(500).send({
				message: 'An error occurred',
			});
		});
});

function startServer() {
	app.listen(PORT, () => {
		console.log(`Server is running on http://localhost:${PORT}`);
	});
}

function parseJSONLeniently(jsonString: string) {
	// First, remove potential comments (both single line and multi-line).
	// This is a basic approach and might need adjustments for complex cases.
	var noCommentsString = jsonString.replace(/\/\/.*?[\r\n]|\/\*.*?\*\//gs, '');

	// Then, fix trailing commas before closing brackets or braces.
	var fixedJsonString = noCommentsString.replace(/,\s*([\]}])/g, '$1');

	// Finally, attempt to parse the cleaned JSON string.
	return JSON.parse(fixedJsonString);
}
