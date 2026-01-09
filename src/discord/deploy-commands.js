import { REST, Routes } from 'discord.js';
import { config } from '../config.js';
import * as fs from 'fs';
import * as path from 'path';

const commands = [];
const commandsPath = path.join(import.meta.dir, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));
async function loadCommands() {
    for (const file of commandFiles) {
        const filePath = path.join(commandsPath, file);
        const command = await import(filePath);
        if ('data' in command && 'execute' in command) {
            commands.push(command.data.toJSON());
        } else {
            console.warn(`[WARNING] The command at ${filePath} is missing a required "data" or "execute" property.`);
        }
    }
}

async function deploy() {
    await loadCommands();

    const rest = new REST().setToken(config.discordToken);

    try {
        console.log(`Started refreshing ${commands.length} application (/) commands.`);
        if (!config.discordClientId) {
            console.error("Error: discordClientId is missing in config.js");
            return;
        }

        if (config.discordGuildId) {
            console.log(`Detected Guild ID: ${config.discordGuildId}. Clearing stale Guild Commands...`);
            await rest.put(
                Routes.applicationGuildCommands(config.discordClientId, config.discordGuildId),
                { body: [] },
            );
            console.log('Successfully cleared application (/) commands from Guild.');
        }

        // Deploy Global Commands
        console.log('Deploying Global Commands (may take up to 1 hour to update)...');
        const dataGlobal = await rest.put(
            Routes.applicationCommands(config.discordClientId),
            { body: commands },
        );
        console.log(`Successfully reloaded ${dataGlobal.length} application (/) commands (Global).`);
        process.exit(0);
    } catch (error) {
        console.error(error);
    }
}

deploy();
