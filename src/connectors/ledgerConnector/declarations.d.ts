// declare module 'web3-provider-engine/subproviders/cache.js'
declare module '@ledgerhq/hw-app-eth' {
  class Eth {
    public transport: LedgerTransport
    constructor(transport: LedgerTransport)
    public getAddress(
      path: string,
      boolDisplay?: boolean,
      boolChaincode?: boolean,
    ): Promise<{ publicKey: string; address: string; chainCode: string }>
    public signTransaction(path: string, rawTxHex: string): Promise<ECSignatureString>
    public getAppConfiguration(): Promise<{ arbitraryDataEnabled: number; version: string }>
    public signPersonalMessage(path: string, messageHex: string): Promise<ECSignature>
  }
  // eslint-disable-next-line import/no-default-export
  export default Eth
}
