import { createInterface } from "node:readline";
import * as fs from 'fs';

//#region Spinner (ConsoleSpinner)

export class ConsoleSpinner {
    private frames: string[];
    private interval: number;
    private text: string;
    private timer: NodeJS.Timeout | null = null;
    private index: number = 0;
    private running: boolean = false;

    public constructor() {
        this.frames = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
        this.interval = 80;
        this.text = "";
    }

    public start(text?: string): void {
        if (this.running) {
            return;
        }

        if (text !== undefined) {
            this.text = text;
        }

        this.running = true;
        process.stdout.write("\x1B[?25l");

        this.timer = setInterval(() => {
            const frame = this.frames[this.index % this.frames.length];
            this.index++;

            process.stdout.write(`\r\x1b[32m${frame}\x1b[0m ${this.text}`);
        }, this.interval);
    }

    public setText(text: string): void {
        this.text = text;
    }

    private stop(finalText?: string): void {
        if (!this.running) {
            return;
        }

        if (this.timer !== null) {
            clearInterval(this.timer);
            this.timer = null;
        }

        this.running = false;
        this.clearLine();
        process.stdout.write("\x1B[?25h");

        if (finalText !== undefined) {
            process.stdout.write(`${finalText}\n`);
        }
    }

    public succeed(text: string = "Done"): void {
        this.stop(`✔ ${text}`);
    }

    public fail(text: string = "Failed"): void {
        this.stop(`✖ ${text}`);
    }

    private clearLine(): void {
        process.stdout.write("\r\x1B[2K");
    }
}

//#endregion

//#region Update Next.js (UpdateNextJS)

import { execFile } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import { promisify } from "node:util";
import path from "node:path";

const execFileAsync = promisify(execFile);

type PackageJson = {
    name: string,
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
    packageManager?: string;
};

async function UpdateNextJS(): Promise<string> {
    const packageJsonPath = path.resolve(process.cwd(), "package.json");
    const packageJson = JSON.parse(await readFile(packageJsonPath, "utf8")) as PackageJson;

    const latestVersion = await getLatestNextVersion();

    let changed = false;

    changed = updateDependency(packageJson.dependencies, "next", latestVersion) || changed;
    changed = updateDependency(packageJson.devDependencies, "next", latestVersion) || changed;

    if (!changed) {
        throw new Error("Cannot find next dependency in your package.json");
    }

    await writeFile(packageJsonPath, `${JSON.stringify(packageJson, null, 4)}\n`, "utf8");

    const manager = detectPackageManager();
    await install(manager);

    return latestVersion;
}

async function getLatestNextVersion(): Promise<string> {
    const { stdout } = await execFileAsync("npm", [
        "view",
        "next",
        "version",
    ]);

    return stdout.trim();
}

function updateDependency(
    dependencies: Record<string, string> | undefined,
    name: string,
    version: string,
): boolean {
    if (dependencies === undefined || dependencies[name] === undefined) {
        return false;
    }

    dependencies[name] = `^${version}`;
    return true;
}

function detectPackageManager(): "npm" | "bun" {
    if (fs.existsSync("bun.lock"))
        return "bun";

    return "npm";
}

async function install(manager: "npm" | "bun"): Promise<void> {
    if (manager === "npm") {
        await execFileAsync("npm", ["install"]);
        return;
    }

    await execFileAsync("bun", ["install"]);
}

//#endregion

const line = createInterface({
    "input": process.stdin,
    "output": process.stdout
});

const readLine = (q: string) => new Promise<string>(r => line.question(`\x1b[1m\x1b[36m?\x1b[0m \x1b[1m${q}\x1b[0m `, r));

(async () => {
    const name = await readLine("What is your project name?");

    const packageJson: PackageJson = JSON.parse(fs.readFileSync("package.json", "utf-8"));
    packageJson.name = name;
    fs.writeFileSync("package.json", JSON.stringify(packageJson, null, 4), "utf-8");

    const layoutTsx = fs.readFileSync("./src/app/layout.tsx", "utf-8");
    fs.writeFileSync("./src/app/layout.tsx", layoutTsx.replaceAll("next-template", name), "utf-8");

    const spinner = new ConsoleSpinner();
    spinner.start("Updating next.js...");

    const nextLatestVersion = await UpdateNextJS();

    spinner.succeed("Updated next.js to " + nextLatestVersion);
})();