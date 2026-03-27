import { DiscordSDK } from '@discord/embedded-app-sdk';

export type Auth = Awaited<ReturnType<typeof DiscordSDK.prototype.commands.authenticate>>;
export type User = Auth['user'];
