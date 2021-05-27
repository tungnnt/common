import * as _ from 'lodash';
import { memoize } from 'lodash';
import { fromPairs } from 'ramda';
import {
  bindNodeCallback,
  combineLatest,
  defer,
  fromEvent,
  identity,
  merge,
  Observable,
  of,
  OperatorFunction,
  Subject,
  timer,
} from 'rxjs';
import { ajax } from 'rxjs/ajax';
import {
  catchError,
  filter,
  first,
  map,
  mergeMap,
  scan,
  shareReplay,
  startWith,
  switchMap,
  takeUntil,
  takeWhile,
  tap,
} from 'rxjs/operators';
import Web3 from 'web3';
import { deserializeTransactions, serializeTransactions } from './serialization';
import {
  CommonContext,
  CommonTxState,
  TxMeta,
  TransactionLike,
  TransactionReceiptLike,
  TxRebroadcastStatus,
  TxState,
  TxStatus,
  GetTransactionReceipt,
  GetTransaction,
  TransactionsChange,
  NewTransactionChange,
  SendFunction,
} from './types';

export class UnreachableCaseError extends Error {
  constructor(val: never) {
    super(`Unreachable case: ${val}`);
  }
}

let txCounter = 1;

export function isDone<A extends TxMeta>(state: TxState<A>): boolean {
  return [TxStatus.CancelledByTheUser, TxStatus.Error, TxStatus.Failure, TxStatus.Success].includes(
    state.status,
  );
}

export function isDoneButNotSuccessful<A extends TxMeta>(state: TxState<A>): boolean {
  return [TxStatus.CancelledByTheUser, TxStatus.Error, TxStatus.Failure].indexOf(state.status) >= 0;
}

export function isSuccess<A extends TxMeta>(state: TxState<A>): boolean {
  return TxStatus.Success === state.status;
}

export function getTxHash<A extends TxMeta>(state: TxState<A>): string | undefined {
  if (
    state.status === TxStatus.Success ||
    state.status === TxStatus.Failure ||
    state.status === TxStatus.Error ||
    state.status === TxStatus.WaitingForConfirmation
  ) {
    return state.txHash;
  }
  return undefined;
}

function createExternalNonce2tx(
  onEveryBlock$: Observable<number>,
  context$: Observable<CommonContext>,
  account: string,
): Observable<ExternalNonce2tx> {
  return combineLatest([context$, onEveryBlock$.pipe(first()), onEveryBlock$]).pipe(
    switchMap(([context, firstBlock]) =>
      ajax({
        url:
          `${context.etherscan.apiUrl}?module=account` +
          `&action=txlist` +
          `&address=${account}` +
          `&startblock=${firstBlock}` +
          `&sort=desc` +
          `&apikey=${context.etherscan.apiKey}`,
      }),
    ),
    map(({ response }) => response.result),
    map((transactions: Array<{ hash: string; nonce: string; input: string }>) =>
      fromPairs(
        _.map(
          transactions,
          (tx) =>
            [tx.nonce, { hash: tx.hash, callData: tx.input }] as [
              string,
              { hash: string; callData: string },
            ],
        ),
      ),
    ),
    catchError((error) => {
      console.error(error);
      return of({});
    }),
    shareReplay(1),
  );
}

const externalNonce2Tx = memoize(
  createExternalNonce2tx,
  (_onEveryBlock$: Observable<number>, _context$: Observable<CommonContext>, account: string) =>
    account,
);

function txRebroadcastStatus(
  account: string,
  context$: Observable<CommonContext>,
  onEveryBlock$: Observable<number>,
  { hash, nonce, input }: TransactionLike,
): Observable<[string, TxRebroadcastStatus]> {
  const externalNonce2tx$ = externalNonce2Tx(onEveryBlock$, context$, account);
  return combineLatest([externalNonce2tx$, onEveryBlock$]).pipe(
    map(([externalNonce2tx]) => {
      if (externalNonce2tx[nonce] && externalNonce2tx[nonce].hash !== hash) {
        return [
          externalNonce2tx[nonce].hash,
          input === externalNonce2tx[nonce].callData
            ? TxRebroadcastStatus.speedup
            : TxRebroadcastStatus.cancel,
        ];
      }
      return [hash, TxRebroadcastStatus.lost];
    }),
  );
}

function successOrFailure<A extends TxMeta>(
  onEveryBlock$: Observable<number>,
  context$: Observable<CommonContext>,
  txHash: string,
  receipt: TransactionReceiptLike,
  common: CommonTxState<A>,
  rebroadcast?: TxRebroadcastStatus,
): Observable<TxState<A>> {
  const end = new Date();
  if (!receipt.status) {
    // TODO: failure should be confirmed!
    return of({
      ...common,
      txHash,
      receipt,
      end,
      lastChange: end,
      blockNumber: receipt.blockNumber,
      status: TxStatus.Failure,
    });
  }

  // TODO: error handling!
  return combineLatest([context$, onEveryBlock$]).pipe(
    map(([context, blockNumber]) => {
      const x: TxState<A> = {
        ...common,
        txHash,
        receipt,
        end,
        rebroadcast,
        lastChange: new Date(),
        blockNumber: receipt.blockNumber,
        status: TxStatus.Success,
        confirmations: Math.max(0, blockNumber - receipt.blockNumber),
        safeConfirmations: context.safeConfirmations,
      };
      return x;
    }),
  );
}

function monitorTransaction<A extends TxMeta>(
  account: string,
  onEveryBlock$: Observable<number>,
  context$: Observable<CommonContext>,
  web3: Web3,
  txHash: string,
  broadcastedAt: Date,
  common: CommonTxState<A>,
): Observable<TxState<A>> {
  const everySecondUpUntil30Min$ = timer(0, 1000).pipe(takeUntil(timer(30 * 60 * 1000)));
  const getTransaction = bindNodeCallback(web3.eth.getTransaction as GetTransaction);
  const getTransactionReceipt = bindNodeCallback(
    web3.eth.getTransactionReceipt as GetTransactionReceipt,
  );
  const propagatingTxState: TxState<A> = {
    ...common,
    broadcastedAt,
    txHash,
    status: TxStatus.Propagating,
  };
  const waitingForConfirmationTxState: TxState<A> = {
    ...common,
    broadcastedAt,
    txHash,
    status: TxStatus.WaitingForConfirmation,
  };
  function errorTxState(error: Error): TxState<A> {
    return {
      ...common,
      error,
      txHash,
      end: new Date(),
      lastChange: new Date(),
      status: TxStatus.Error,
    };
  }
  function notEnoughConfirmations(state: TxState<A>) {
    return (
      !isDone(state) ||
      (state.status === TxStatus.Success && state.confirmations < state.safeConfirmations)
    );
  }
  const txState$ = everySecondUpUntil30Min$.pipe(
    switchMap(() => getTransaction(txHash)),
    filter((transaction) => transaction !== null) as OperatorFunction<
      TransactionLike | null,
      TransactionLike
    >,
    first(),
    mergeMap((transaction: TransactionLike) =>
      txRebroadcastStatus(account, context$, onEveryBlock$, transaction).pipe(
        switchMap(
          ([hash, rebroadcast]: [string, TxRebroadcastStatus]) =>
            getTransactionReceipt(hash).pipe(
              filter((receipt) => receipt && !!receipt.blockNumber),
              map((receipt) => [receipt, rebroadcast]),
            ) as Observable<[TransactionReceiptLike, TxRebroadcastStatus]>,
        ),
        first(),
        mergeMap(([receipt, rebroadcast]) =>
          successOrFailure(
            onEveryBlock$,
            context$,
            receipt.transactionHash,
            receipt,
            common,
            rebroadcast,
          ),
        ),
        takeWhile(notEnoughConfirmations, true),
        startWith(waitingForConfirmationTxState),
        catchError((error) => of(errorTxState(error))),
      ),
    ),
    startWith(propagatingTxState),
  );
  return txState$;
}

function send<A extends TxMeta>(
  onEveryBlock$: Observable<number>,
  context$: Observable<CommonContext>,
  change: (change: NewTransactionChange<A>) => void,
  account: string,
  networkId: string,
  meta: A,
  method: (...args: any[]) => any, // Any contract method
): Observable<TxState<A>> {
  const common = {
    account,
    networkId,
    meta,
    txNo: txCounter += 1,
    start: new Date(),
    lastChange: new Date(),
    dismissed: false,
  };
  const waitingForApprovalTxState: TxState<A> = {
    ...common,
    status: TxStatus.WaitingForApproval,
  };
  function cancelledByTheUserTxState(error: Error): TxState<A> {
    return {
      ...common,
      error,
      end: new Date(),
      lastChange: new Date(),
      status: TxStatus.CancelledByTheUser,
    };
  }

  const promiEvent = method();
  const result: Observable<TxState<A>> = context$.pipe(
    first(),
    switchMap(({ web3 }) =>
      merge(fromEvent(promiEvent, 'transactionHash'), promiEvent).pipe(
        map((txHash: string) => [txHash, new Date()] as [string, Date]),
        first(),
        mergeMap(([txHash, broadcastedAt]: [string, Date]) =>
          monitorTransaction(
            account,
            onEveryBlock$,
            context$,
            web3,
            txHash,
            broadcastedAt,
            common as TxState<A>,
          ),
        ),
        startWith(waitingForApprovalTxState),
        catchError((error) => {
          if ((error.message as string).indexOf('User denied transaction signature') === -1) {
            console.error(error);
          }
          return of(cancelledByTheUserTxState(error));
        }),
      ),
    ),
    shareReplay(1),
  );
  result.subscribe((state) => change({ state, kind: 'newTx' }));
  return result;
}

interface ExternalNonce2tx {
  [nonce: number]: { hash: string; callData: string };
}

function createTransactions$<A extends TxMeta>(
  account$: Observable<string>,
  context$: Observable<CommonContext>,
  onEveryBlock$: Observable<number>,
): [Observable<TxState<A>[]>, (ch: TransactionsChange<A>) => void] {
  const transactionObserver: Subject<TransactionsChange<A>> = new Subject();

  const txs$: Observable<TxState<A>[]> = transactionObserver.pipe(
    scan((transactions: TxState<A>[], change: TransactionsChange<A>) => {
      switch (change.kind) {
        case 'cachedTx':
        case 'newTx': {
          const newState = change.state;
          const result = [...transactions];
          const i = result.findIndex((t) => t.txNo === newState.txNo);
          if (i >= 0) {
            result[i] = newState;
          } else {
            result.push(newState);
          }
          return result;
        }
        case 'dismissed': {
          const result = [...transactions];
          const i = result.findIndex((t) => t.txNo === change.txNo);

          result[i].dismissed = true;

          return result;
        }
        default:
          throw new UnreachableCaseError(change);
      }
    }, []),
    shareReplay(1),
  );
  txs$.subscribe(identity);

  const persistentTxs$ = persist(account$, onEveryBlock$, context$, txs$, change);

  const accountTxs$: Observable<TxState<A>[]> = combineLatest([
    persistentTxs$,
    account$,
    context$,
  ]).pipe(
    map(([txs, account, context]) =>
      txs.filter((t: TxState<A>) => t.account === account && t.networkId === context.id),
    ),
    startWith([] as TxState<A>[]),
    shareReplay(1),
  );
  function change(ch: TransactionsChange<A>) {
    transactionObserver.next(ch);
  }

  return [accountTxs$, change];
}

function sendCurried<A extends TxMeta>(
  onEveryBlock$: Observable<number>,
  context$: Observable<CommonContext>,
  change: (change: NewTransactionChange<A>) => void,
) {
  return (account: string, networkId: string, meta: A, method: (...args: any[]) => any) =>
    send<A>(onEveryBlock$, context$, change, account, networkId, meta, method);
}

function saveTransactions<A extends TxMeta>(transactions: TxState<A>[]) {
  if (transactions.length) {
    localStorage.setItem('transactions', serializeTransactions(transactions));
  }
}

function persist<A extends TxMeta>(
  account$: Observable<string>,
  onEveryBlock$: Observable<number>,
  context$: Observable<CommonContext>,
  transactions$: Observable<TxState<A>[]>,
  change: (ch: TransactionsChange<A>) => void,
): Observable<TxState<A>[]> {
  return defer(() => {
    return context$.pipe(
      switchMap(({ web3 }) => {
        return account$.pipe(
          switchMap((account) => {
            const serializedTransactions = localStorage.getItem('transactions');
            if (!serializedTransactions) {
              return transactions$;
            }

            const deserializedTransactions: TxState<A>[] = deserializeTransactions(
              serializedTransactions,
            );

            txCounter = deserializedTransactions.reduce(
              (txNo, tx) => (tx.txNo > txNo ? tx.txNo : txNo),
              txCounter,
            );

            const pendingTransactions$ = merge(
              ...deserializedTransactions
                .filter(
                  (tx) =>
                    tx.status === TxStatus.WaitingForConfirmation ||
                    tx.status === TxStatus.Propagating,
                )
                .map(
                  (tx): Observable<TxState<A>> =>
                    tx.status === TxStatus.WaitingForConfirmation ||
                    tx.status === TxStatus.Propagating
                      ? monitorTransaction(
                          account,
                          onEveryBlock$,
                          context$,
                          web3,
                          tx.txHash,
                          tx.broadcastedAt,
                          tx,
                        )
                      : of(),
                ),
            );
            pendingTransactions$.subscribe((state) => change({ kind: 'cachedTx', state }));

            deserializedTransactions
              .filter(
                (tx) =>
                  tx.status !== TxStatus.WaitingForConfirmation &&
                  tx.status !== TxStatus.Propagating,
              )
              .forEach((state) => change({ kind: 'cachedTx', state }));

            return transactions$;
          }),
        );
      }),
    );
  }).pipe(tap(saveTransactions));
}

export function createSend<A extends TxMeta>(
  account$: Observable<string>,
  onEveryBlock$: Observable<number>,
  context$: Observable<CommonContext>,
): [SendFunction<A>, Observable<TxState<A>[]>, (txNo: number) => void] {
  const [transactions$, change] = createTransactions$<A>(account$, context$, onEveryBlock$);

  const zend = sendCurried<A>(onEveryBlock$, context$, change);

  return [zend, transactions$, (txNo: number) => change({ kind: 'dismissed', txNo })];
}
