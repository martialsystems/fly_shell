import { FlyShell, installGlobal } from "./shell.js";

const shell = new FlyShell();
installGlobal(shell);
shell.start();
