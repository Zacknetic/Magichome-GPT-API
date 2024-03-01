import express from 'express';
import OpenAI from 'openai';
import dotenv from 'dotenv';
import cors from 'cors';


//import txt file as a string
const fs = require('fs');
const path = require('path');
const filePath = path.join(__dirname, 'systemPrompt.txt');
const systemPrompt = fs.readFileSync(filePath, 'utf8');


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
export class GptMagicHome {
	controllerGenerator = new ControllerGenerator();
	app!: express.Application;
	PORT!: number;
	controllers = new Map<string, any>();
	openai!: OpenAI;

	constructor(app: express.Application, PORT: number) {

		this.app = app;
		this.PORT = PORT;
		this.init();
	}

	public init() {
		this.setupControllers().then((lightStates) => {
			currlightStates.lightStates = lightStates;
			console.log('lightStates', JSON.stringify(currlightStates));
			this.setupApp();
			this.startServer();
		});

		this.openai = new OpenAI({
			organization: 'org-bk09CWfxrbtm1FOB2cqXq4Ra',
			apiKey: process.env.API_KEY,
		});

	}

	async setupControllers() {
		this.controllers =
			await this.controllerGenerator.discoverCompleteControllers();

		const lightStates = this.controllerGenerator.controllerListToSimpleList(
			this.controllers
		) as any;
		return lightStates;
	}

	async sendToOpenAI(userInstruction: string) {
		return this.openai.chat.completions
			.create({
				model: 'gpt-3.5-turbo-0125', //FRED
				// temperature: 0,
				messages: [
					{
						role: 'system',
						content: systemPrompt
					},
					{
						role: 'user',
						content: 
						`
						{
							"homeInformation": ${JSON.stringify(currlightStates)},
							"userInstruction": "${userInstruction}",
							"totalLights": ${this.controllers.size}
                    	}
						`,
					},
				],
			})
			.then(async (response) => {
				const messageContent = response.choices[0].message.content as string;
				console.log('messageContent', messageContent);
				const messageContentJSON = await this.parseJSONLeniently(
					messageContent
				);

				return messageContentJSON;
			})
			.catch((error) => {
				console.log(error);
			});
	}

	setupApp() {
		this.app.use(express.json());
		this.app.use(cors()); // Enable CORS for all routes.

		this.app.get('/api/test', async (req, res) => {
			// const simpleControllers = await setupControllers();
			// res.send(JSON.stringify(simpleControllers));
			res.send('works');
		});

		this.app.get('/api/getLights', async (req, res) => {
			const simpleControllers = await this.setupControllers();
			res.send(JSON.stringify(simpleControllers));

			// res.send("works")
		});
		this.app.get('/api/setColor/', (req, res) => {
			const { userInstruction } = req.body;
			console.log('userInstruction', userInstruction);
			this.sendToOpenAI(userInstruction)
				.then((response) => {
					if (response) {
						console.log('returning response', response.lightStates);
						response.lightStates.forEach((group: any) => {
							group.idList.forEach((lightId: string) => {
								const controller = this.controllers.get(lightId);
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
    
            <pre>${JSON.stringify(
							respose.lightStates
						)}</pre> <!-- Display the JSON response here -->
        </body>
        </html>
        `;
					res.send(htmlResponse);
					new Promise((resolve) => {
						setTimeout(async () => {
							await this.setupControllers().then((lightStates) => {
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
	}

	startServer() {
		this.app.listen(this.PORT, () => {
			console.log(`Server is running on http://localhost:${this.PORT}`);
		});
	}

	parseJSONLeniently(jsonString: string) {
		// First, remove potential comments (both single line and multi-line).
		// This is a basic approach and might need adjustments for complex cases.
		var noCommentsString = jsonString.replace(
			/\/\/.*?[\r\n]|\/\*.*?\*\//gs,
			''
		);

		// Then, fix trailing commas before closing brackets or braces.
		var fixedJsonString = noCommentsString.replace(/,\s*([\]}])/g, '$1');

		// Finally, attempt to parse the cleaned JSON string.
		return JSON.parse(fixedJsonString);
	}
}
