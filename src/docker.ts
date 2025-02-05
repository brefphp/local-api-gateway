import { spawn } from 'child_process';

/**
 * Utility function to promisify spawn
 *
 * @param command The command to run
 * @param args The args as an array of strings
 */
const asyncSpawn = (command: string, args: string[]): Promise<{ stdout: string; stderr: string }> => {
    return new Promise((resolve, reject) => {
        const process = spawn(command, args);
        let stdout = '';
        let stderr = '';

        process.stdout.on('data', (data) => {
            stdout += data.toString();
        });

        process.stderr.on('data', (data) => {
            stderr += data.toString();
        });

        process.on('close', (code) => {
            if (code === 0) {
                resolve({ stdout, stderr });
            } else {
                reject(new Error(`Command exited with code ${code}\nSTDOUT: ${stdout}\nSTDERR: ${stderr}`));
            }
        });

        process.on('error', (err) => {
            reject(err);
        });
    });
};

/**
 * Handles bref-local output headers
 *
 * The 'bref-local' handler returns the following header which needs to be stripped:
 * v
 * START
 * END Duration ...
 *
 * ^
 * (real output begins under this line)
 *
 * @param input
 */
function removeBrefLocalHeaders(input: string): string {
    const match = input.match(/END Duration:.*\n([\s\S]*)/);
    return match ? match[1].trim() : "";
}

/**
 * Runs the Docker Exec command
 *
 * @param container The docker container name (e.g. 'php')
 * @param handler The handler command (e.g. '/path/to/vendor/bref/bref-local handler.php')
 * @param payload The JSON-encoded payload
 */
export const runDockerCommand = async (container: string, handler: string, payload: string): Promise<string> => {
    // Build the docker command: '/usr/bin/docker exec $CONTAINER $HANDLER $PAYLOAD' for spawn
    const [command, ...handlerArgs] = handler.split(' ');
    const dockerCommand = [
        "exec",
        container,
        command,
        ...handlerArgs,
        payload,
    ];

    // Run the command and pull the output into a string
    let result: string|null = null;
    try {
        const { stdout, stderr } = await asyncSpawn("/usr/bin/docker", dockerCommand);
        if (stderr) {
            console.info(`END [DOCKER] COMMAND: `, dockerCommand);
            console.error(`END [DOCKER] STDERR: ${stderr}`);
        }
        result = Buffer.from(stdout).toString();
    } catch (error) {
        console.info(`END [DOCKER] COMMAND: `, dockerCommand);
        console.error(`END [DOCKER] ERROR: ${(error as Error).message}`);
        throw error;
    }

    // Strip header info from bref-local output
    if (handler?.includes('bref-local')) {
        result = removeBrefLocalHeaders(result);
    }

    return result;
}
