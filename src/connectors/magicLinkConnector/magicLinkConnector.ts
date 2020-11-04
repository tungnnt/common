import { AbstractConnector } from '@web3-react/abstract-connector';
import { ConnectorUpdate } from '@web3-react/types';
import { noop } from 'lodash';
import { Magic, MagicUserMetadata, RPCError, RPCErrorCode } from 'magic-sdk';

import { NetworkName } from '../../types';

interface MagicLinkArguments {
  apiKey: string;
  chainId: number;
  network: NetworkName;
  email: string;
}

export class UserRejectedRequestError extends Error {
  public constructor() {
    super();
    this.name = this.constructor.name;
    this.message = 'The user rejected the request.';
  }
}

export class FailedVerificationError extends Error {
  public constructor() {
    super();
    this.name = this.constructor.name;
    this.message = 'The email verification failed.';
  }
}

export class MagicLinkRateLimitError extends Error {
  public constructor() {
    super();
    this.name = this.constructor.name;
    this.message = 'The Magic rate limit has been reached.';
  }
}

export class MagicLinkExpiredError extends Error {
  public constructor() {
    super();
    this.name = this.constructor.name;
    this.message = 'The Magic link has expired.';
  }
}

export class MagicLinkConnector extends AbstractConnector {
  private readonly apiKey: string;
  private readonly chainId: number;
  private readonly network: NetworkName;
  private readonly email: string;

  private provider?: Magic;

  constructor({ apiKey, chainId, network, email }: MagicLinkArguments) {
    super({ supportedChainIds: [chainId] });

    this.apiKey = apiKey;
    this.chainId = chainId;
    this.network = network;
    this.email = email;
  }

  public async activate(): Promise<ConnectorUpdate> {
    if (!this.provider) {
      this.provider = new Magic(this.apiKey, {
        network: this.network,
      });
    }

    const isLoggedIn = await this.provider.user.isLoggedIn();
    const loggedInEmail = isLoggedIn ? (await this.provider.user.getMetadata()).email : null;
    const emailChanged = loggedInEmail !== this.email;

    if (isLoggedIn && emailChanged) {
      await this.provider.user.logout();
    }

    if (!isLoggedIn || emailChanged) {
      try {
        await this.provider.auth.loginWithMagicLink({ email: this.email });
      } catch (err) {
        if (!(err instanceof RPCError)) {
          throw err;
        }
        if (err.code === RPCErrorCode.MagicLinkFailedVerification) {
          throw new FailedVerificationError();
        }
        if (err.code === RPCErrorCode.MagicLinkExpired) {
          throw new MagicLinkExpiredError();
        }
        if (err.code === RPCErrorCode.MagicLinkRateLimited) {
          throw new MagicLinkRateLimitError();
        }
        // This error gets thrown when users close the login window.
        // -32603 = JSON-RPC InternalError
        if (err.code === -32603) {
          throw new UserRejectedRequestError();
        }
      }
    }

    const provider = this.provider.rpcProvider;
    const account = await provider.enable().then((accounts: string[]): string => accounts[0]);

    return { provider: this.provider.rpcProvider, chainId: this.chainId, account };
  }

  public async getProvider(): Promise<any> {
    return this.provider;
  }

  public async getChainId(): Promise<number> {
    return this.chainId;
  }

  public async getAccount(): Promise<null | string> {
    return this.provider
      ? this.provider.rpcProvider
          .send('eth_accounts')
          .then((accounts: string[]): string => accounts[0])
      : null;
  }

  public async getMetadata(): Promise<undefined | MagicUserMetadata> {
    return await this.provider?.user.getMetadata();
  }

  public getEmail(): string {
    return this.email;
  }

  public deactivate(): void {
    noop();
  }

  public async close(): Promise<void> {
    await this.provider?.user.logout();
    this.emitDeactivate();
  }
}
