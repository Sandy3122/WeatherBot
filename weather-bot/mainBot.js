const { DialogSet, TextPrompt, WaterfallDialog } = require("botbuilder-dialogs");

const { ActivityHandler, MessageFactory, CardFactory, TurnContext } = require("botbuilder");

// To fetch weather api url
const fetch = require("node-fetch");

class myWeatherBot extends ActivityHandler {
    constructor(conversationState, conversationReference) {
        // Call the constructor of the parent class (ActivityHandler)
        super();

        // Store the provided conversation reference for later use
        this.conversationReference = conversationReference || {};   // Initialize conversationReference as an object

        // Create a property to manage dialog state within the conversation state
        this.dialogState = conversationState.createProperty("dialogState");

        // Create a DialogSet to manage dialogs
        this.dialogs = new DialogSet(this.dialogState);

        // Create instances of TextPrompt and locationPrompt for dialogs
        const textPrompt = new TextPrompt('textPrompt');
        const location = new TextPrompt('location');

        //  Adding the prompts to the dialog set
        this.dialogs.add(textPrompt);
        this.dialogs.add(location);

        // Creating a WaterfallDialog and adding steps to it
        this.dialogs.add(new WaterfallDialog('waterFall', [
            this.step1.bind(this),
            this.step2.bind(this),
            this.step3.bind(this)
        ]))

        this.dialogs.add(new WaterfallDialog('waterFall2', [
            this.step4.bind(this),
            this.step3.bind(this)
        ]))

        // Handling incoming messages
        this.onMessage(async (context, next) => {

            // Creating a dialog context based on the incoming context
            const dialogContext = await this.dialogs.createContext(context)
            try {
                if (!context.responded) {
                    console.log(`User said: ${context._activity.text}`);
                    // If the bot hasn't responded to the user yet, check if there's an active dialog
                    if (!dialogContext.activeDialog) {
                        // If there's no active dialog, check the user's input
                        if (context.activity.text.toLowerCase() === 'hello' ||
                            context.activity.text.toLowerCase() === 'hi' ||
                            context.activity.text.toLowerCase() === 'hai' ||
                            context.activity.text.toLowerCase() === 'hi bot') {
                            await dialogContext.beginDialog('waterFall');
                        } else {
                            // Send a message if the user's input isn't recognized
                            await context.sendActivity("Sorry, I didn't understand what you said. 😕")
                        }
                    } else {
                        // Continue the active dialog if there is one
                        await dialogContext.continueDialog();
                    }
                }
            }
            catch (error) {
                console.error(`Error processing message: ${error.message}`);
            }

            // Save conversation state changes and proceed to the next middleware
            await conversationState.saveChanges(context);
            await next();

        });


        // Handle members being added to the conversation
        this.onMembersAdded(async (context, next) => {
            const memberAdded = context.activity.membersAdded;
            const WelcomeText = 'Hello and WellCome to the Weather Bot'
            for (let count = 0; count < memberAdded.length; ++count) {
                if (memberAdded[count].id !== context.activity.recipient.id) {
                    await context.sendActivity(MessageFactory.text(WelcomeText))
                }
            }
            // By calling next() you ensure that the next BotHandler is run.
            await next();
        });

        // Handling Conversation Updates

        this.onConversationUpdate(async (context, next) => {
            try {
                console.log("conversation update", context)
                // Get the conversation reference from the activity
                var conversationRef = TurnContext.getConversationReference(context.activity);
                console.log("conversation update", conversationRef)

                // Store the conversation reference for future use
                this.conversationReference[conversationRef.conversation.id] = conversationRef;

            }
            catch (error) {
                console.error(`Error processing conversation update: ${error.message}`);
            }
        })

    }

    // Waterfall step1: Get user's name
    async step1(step) {
        try {
            console.info("Step1");
            await step.context.sendActivity("Hi There! Please enter your name.");
            return await step.prompt('textPrompt');
        }
        catch (error) {
            console.error(`Error In Step1 : ${error.message}`);
        }
    }

    // Waterfall step: Ask for location
    async step2(step) {
        step.values.name = step.result;
        try {
            console.info("Step2");
            // Store the user's name in the dialog state
            const card = CardFactory.heroCard(
                `Hello ${step.result} 🥰`,
                `Welcome to the 'Hello Weather Bot'. Please Provide Me The Location`,
                CardFactory.images(['https://liteapks.com/wp-content/uploads/2022/10/hello-weather-1.jpg'])
            )

            await step.context.sendActivity({ attachments: [card] });
            return await step.prompt('location');
        }
        catch (error) {
            console.error(`Error in Step2 : ${error.message}`);

            // Handle the error by sending an error message to the user
            await step.context.sendActivity("Oops! Something went wrong Please give valid location");

        }
    }

    // WaterFall2 step4 : Asking user for location for remaining times
    async step4(step){
        // console.log("User name in step4:", step.values.name);  // Add this line for debugging
        try{
            console.info("Step4");
            const card = CardFactory.heroCard(
                `Ready for a new location adventure? 🌍`,
                `If you've got another place in mind, I'm all ears! Let's uncover the weather secrets of a new spot together! 🌦️`,
                
            )

            await step.context.sendActivity({ attachments: [card] });
            return await step.prompt('location');

        }
        catch(error){
            console.error(`Error in WaterFall2 Step4 : ${error.message}`);

            // Handle the error by sending an error message to the user
            await step.context.sendActivity("Oops! Something went wrong. Maybe the weather took a vacation. Please provide a valid location so I can find it for you! 🌦️");

        }
    }

    // Waterfall step3: Retrieve and display weather information
    async step3(step) {
        try {
            console.info("Step3");
            const myLocation = step.result;
            // Get the array of weather data
            const weatherData = await getLocation(myLocation);
            if(weatherData !== null){
                // Destructure the array
                const [locationName, temperature, feelsLike, condition, icon] = weatherData;

                // Construct the complete URL for the weather icon using the base URL
                const iconUrl = `https:${icon}`;

                // Create a hero card with weather information
                const card = CardFactory.heroCard(
                    `Location: ${locationName}`,
                    `The temperature is ${temperature}°C. Feels like: ${feelsLike}°C. Condition: ${condition}.`, 
                    CardFactory.images([iconUrl]),
                    // CardFactory.images(['https://img.freepik.com/free-vector/watercolor-weather-effects-collection_23-2149115331.jpg?w=2000'])
                );
                
                // Send the weather card
                await step.context.sendActivity({attachments : [card]});
            } else {
                await step.context.sendActivity('I apologize; I was unable to collect the weather information for the specified area.');
            }

            // Restart the waterfall dialog
            return await step.beginDialog('waterFall2');
            // return await step.replaceDialog('waterFall', step.values);
    
        }
        catch (error) {
            console.error(`Error in Step 3 : ${error.message}`);

            // Handle the error by sending a custom error message to the user for Step 3
            await step.context.sendActivity("Oops! Something went wrong please enter the correct location. Please try again.");

            // Restart the waterfall dialog for Step 3
            return await step.replaceDialog('waterFall2', step.values);
        }
    }


}

// Fetch temperature data for a location
async function getLocation(location) {
    const apiKey = '55d3aee711294a4f981172318232106';
    try {
        const url = `https://api.weatherapi.com/v1/current.json?key=${apiKey}&q=${encodeURIComponent(location)}&aqi=yes&units=metric`;
        const response = await fetch(url);
        const data = await response.json();
        
        // Extract required weather parameters and return them as an array
        const locationName = data.location.name
        const temperature = data.current.temp_c;
        const feelsLike = data.current.feelslike_c;
        const condition = data.current.condition.text;
        const icon = data.current.condition.icon;

        return [locationName, temperature, feelsLike, condition, icon];
    } catch (error) {
        console.error(`Error fetching weather data: ${error.message}`);
        throw error;
    }
}


// Export the WeatherBot class
module.exports.myWeatherBot = myWeatherBot;