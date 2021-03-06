import Accounts from '../accounts';
import rpcTypes from './types';
import {
    TxInBlock, Tx as GrpcTx,
    StateQueryProof,
    ABI as GrpcABI,
    Block as GrpcBlock,
    Receipt as GrpcReceipt,
} from '../../types/blockchain_pb';
import {
    Empty, PeerList as GrpcPeerList, Peer as GrpcPeer,
    BlockchainStatus as GrpcBlockchainStatus, CommitResultList,
    Name, NameInfo, Staking, ChainInfo as GrpcChainInfo,
    SingleBytes,
    EventList,
    PeersParams,
    ConsensusInfo,
    ServerInfo, KeyParams,
    VoteParams, Vote,
    NodeReq
} from '../../types/rpc_pb';
import { fromNumber, errorMessageForCode } from '../utils';
import promisify from '../promisify';
import { decodeTxHash, encodeTxHash } from '../transactions/utils';
import Tx from '../models/tx';
import Block from '../models/block';
import BlockMetadata from '../models/blockmetadata';
import Address from '../models/address';
import Peer from '../models/peer';
import State from '../models/state';
import Amount from '../models/amount';
import ChainInfo from '../models/chaininfo';
import Event from '../models/event';
import { FunctionCall, StateQuery } from '../models/contract';
import FilterInfo from '../models/filterinfo';
import { TransactionError } from '../errors';
import { Buffer } from 'buffer';

import bs58 from 'bs58';
import { stringToArrayBuffer } from '@improbable-eng/grpc-web/dist/typings/transports/http/xhr';

const CommitStatus = rpcTypes.CommitStatus;
export { CommitStatus };

type PromiseFunction = (n: any) => Promise<any>;
function waterfall(fns: PromiseFunction[]) {
    return async function(input: any): Promise<any> {
        let result = input;
        for (const fn of fns) {
            result = await fn(result);
        }
        return result;
    }
}
async function marshalEmpty(): Promise<Empty> {
    return new Empty();
}

interface GetTxResult {
    block?: {
        hash: string;
        idx: number;
    }
    tx: Tx
}

interface GetReceiptResult {
    contractaddress: Address;
    result: string;
    status: string;
    fee: Amount;
    cumulativefee: Amount;
    blockno: number;
    blockhash: string;
}

interface NameInfoResult {
    name: string;
    owner: Address;
    destination: Address;
}

interface ConsensusInfoResult {
    type: string;
    info: object;
    bpsList: object[];
}

interface ServerInfoResult {
    configMap: Map<string, Map<string, string>>;
    statusMap: Map<string, string>;
}


interface Stream<T> {
    on(eventName: string, callback: ((obj: T) => void)): void;
    cancel(): void;
    _stream: any;
}

/**
 * Main aergo client controller.
 */
class AergoClient {
    config: object;
    client: any;
    accounts: Accounts;
    target: string;
    private chainIdHash?: Uint8Array;
    static defaultProviderClass?: {new (...args : any[]): any;};
    static platform: string = '';

    /**
     * Create a new auto-configured client with:
     * 
     * .. code-block:: javascript
     * 
     *     import AergoClient from '@herajs/client';
     *     const aergo = new AergoClient();
     * 
     * @param [object] configuration. Unused at the moment.
     * @param [Provider] custom configured provider. By default a provider is configured automatically depending on the environment.
     */
    constructor (config = {}, provider = null) {
        this.config = {
            ...config
        };
        this.client = provider || this.defaultProvider();
        this.accounts = new Accounts(this);
    }

    defaultProvider() {
        // returns a new instance of defaultProviderClass
        // which will be overriden during build according to platform
        return new AergoClient.defaultProviderClass();
    }

    /**
     * Set a new provider
     * @param {Provider} provider
     */
    setProvider(provider) {
        this.client = provider;
        this.chainIdHash = undefined;
    }

    getConfig () {
        return this.config;
    }

    isConnected () {
        // FIXME
        return false;
    }

    grpcMethod<I, O>(method: Function): (request: I) => Promise<O> {
        return (request: I) => promisify(method, this.client.client)(request);
    }

    /**
     * Set the chain id hash to use for subsequent transactions.
     * @param hash string (base58 encoded) or byte array
     */
    setChainIdHash(hash: string | Uint8Array) {
        if (typeof hash === 'string') {
            this.chainIdHash = bs58.decode(hash);
        } else {
            this.chainIdHash = hash;
        }
    }

    /**
     * Request chain id hash. This automatically gathers the chain id hash
     * from the current node if not specified.
     * @param enc set to 'base58' to retrieve the hash encoded in base58. Otherwise returns a Uint8Array.
     * @returns {Promise<Uint8Array | string>} Uint8Array by default, base58 encoded string if enc = 'base58'.
     */
    //async getChainIdHash(enc?: 'base58'): Promise<string>;
    //async getChainIdHash(enc?: '' | undefined): Promise<Uint8Array>;
    async getChainIdHash(enc?: string): Promise<Uint8Array | string> {
        let hash: Uint8Array;
        if (typeof this.chainIdHash === 'undefined') {
            // Fetch blockchain data to set chainIdHash
            await this.blockchain();
        }
        hash = this.chainIdHash;
        if (enc === 'base58') {
            return bs58.encode(Buffer.from(hash));
        }
        return hash;
    }

    /**
     * Request current status of blockchain.
     * @returns {Promise<object>} an object detailing the current status
     */
    blockchain (): Promise<GrpcBlockchainStatus.AsObject> {
        const _this = this;
        return waterfall([
            marshalEmpty,
            this.grpcMethod<Empty, GrpcBlockchainStatus>(this.client.client.blockchain),
            async function unmarshal(response: GrpcBlockchainStatus): Promise<GrpcBlockchainStatus.AsObject> {
                if (typeof _this.chainIdHash === 'undefined') {
                    // set chainIdHash automatically
                    _this.setChainIdHash(Buffer.from(response.getBestChainIdHash_asU8()));
                }
                return {
                    ...response.toObject(),
                    bestBlockHash: Block.encodeHash(response.getBestBlockHash_asU8()),
                    bestChainIdHash: Block.encodeHash(response.getBestChainIdHash_asU8())
                };
            },
        ])(null);
    }

    /**
     * Request current status of blockchain.
     * @returns {Promise<object>} an object detailing the current status
     */
    getChainInfo (): Promise<ChainInfo> {
        return waterfall([
            marshalEmpty,
            this.grpcMethod<Empty, GrpcChainInfo>(this.client.client.getChainInfo),
            async function unmarshal(response: GrpcChainInfo): Promise<ChainInfo> {
                return ChainInfo.fromGrpc(response);
            }
        ])(null);
    }

    /**
     * Request current status of node.
     * @returns {Promise<any>} an object detailing the state of various node components
     */
    getNodeState (component?: string, timeout = 5): Promise<any> {
        return waterfall([
            async function marshal(component?: string): Promise<NodeReq> {
                const params = new NodeReq();
                params.setTimeout(fromNumber(timeout));
                if (typeof component !== 'undefined') {
                    params.setComponent(Buffer.from(component));
                }
                return params;
            },
            this.grpcMethod<NodeReq, SingleBytes>(this.client.client.nodeState),
            async function unmarshal(response: SingleBytes): Promise<any> {
                return JSON.parse(Buffer.from(response.getValue_asU8()).toString());
            }
        ])(component);
    }

    /**
     * Get transaction information in the aergo node. 
     * If transaction is in the block return result with block hash and index.
     * @param {string} txhash transaction hash
     * @returns {Promise<object>} transaction details, object of tx: <Tx> and block: { hash, idx }
     */
    getTransaction (txhash): Promise<GetTxResult> {
        const singleBytes = new rpcTypes.SingleBytes();
        singleBytes.setValue(Uint8Array.from(decodeTxHash(txhash)));
        return new Promise((resolve, reject) => {
            this.client.client.getBlockTX(singleBytes, (err, result: TxInBlock) => {
                if (err) {
                    this.client.client.getTX(singleBytes, (err, result: GrpcTx) => {
                        if (err) {
                            reject(err);
                        } else {
                            const res = <any>{};
                            res.tx = Tx.fromGrpc(result);
                            resolve(res);
                        }
                    });
                } else {
                    const res = <any>{};
                    res.block = {
                        hash: Block.encodeHash(result.getTxidx().getBlockhash_asU8()),
                        idx: result.getTxidx().getIdx()
                    };
                    res.tx = Tx.fromGrpc(result.getTx());
                    resolve(res);
                }
            });
        });
    }

    /**
     * Retrieve information about a block.
     * 
     * @param hashOrNumber either 32-byte block hash encoded as a bs58 string or block height as a number.
     * @returns block details
     */
    getBlock (hashOrNumber: string | number): Promise<Block> {
        return waterfall([
            async function marshal(hashOrNumber: string | number): Promise<SingleBytes> {
                if (typeof hashOrNumber === 'undefined') {
                    throw new Error('Missing argument block hash or number');
                }
                let input;
                if (typeof hashOrNumber === 'string') {
                    input = Block.decodeHash(hashOrNumber);
                } else
                if (typeof hashOrNumber === 'number') {
                    input = fromNumber(hashOrNumber);
                }
                if (input.length != 32 && input.length != 8) {
                    throw new Error('Invalid block hash. Must be 32 byte encoded in bs58. Did you mean to pass a block number?');
                }
                const singleBytes = new SingleBytes();
                singleBytes.setValue(Uint8Array.from(input));
                return singleBytes;
            },
            this.grpcMethod<SingleBytes, GrpcBlock>(this.client.client.getBlock),
            async function unmarshal(response: GrpcBlock): Promise<Block> {
                return Block.fromGrpc(response);
            }
        ])(hashOrNumber);
    }

    /**
     * Retrieve the last n blocks, beginning from given block .
     * 
     * @param {string|number} hashOrNumber either 32-byte block hash encoded as a bs58 string or block height as a number.
     * @param {number} size number of blocks to return
     * @returns {Promise<Block[]>} list of block headers (blocks without body)
     */
    getBlockHeaders (hashOrNumber, size = 10, offset = 0, desc = true) {
        const params = new rpcTypes.ListParams();
        if (typeof hashOrNumber === 'string') {
            hashOrNumber = Block.decodeHash(hashOrNumber);
            if (hashOrNumber.length != 32) {
                throw new Error('Invalid block hash. Must be 32 byte encoded in bs58. Did you mean to pass a block number?');
            }
            params.setHash(Uint8Array.from(hashOrNumber));
        } else
        if (typeof hashOrNumber === 'number') {
            params.setHeight(hashOrNumber);
        } else {
            throw new Error('Block hash or number required.');
        }
        params.setSize(size);
        params.setOffset(offset);
        params.setAsc(!desc);
        return promisify(this.client.client.listBlockHeaders, this.client.client)(params).then(result => {
            return result.getBlocksList().map(item => Block.fromGrpc(item));
        });
    }

    getBlockStream () {
        const empty = new rpcTypes.Empty();
        const stream = this.client.client.listBlockStream(empty);
        try {
            stream.on('error', (error) => {
                if (error.code === 1) { // grpc.status.CANCELLED
                    return;
                }
            });
        } catch (e) {
            // ignore. 'error' does not work on grpc-web implementation
        }
        return {
            _stream: stream,
            on: (ev, callback) => stream.on(ev, data => callback(Block.fromGrpc(data))),
            cancel: () => stream.cancel()
        } as Stream<Block>;
    }

    getBlockMetadataStream () {
        const empty = new rpcTypes.Empty();
        const stream = this.client.client.listBlockMetadataStream(empty);
        try {
            stream.on('error', (error) => {
                if (error.code === 1) { // grpc.status.CANCELLED
                    return;
                }
            });
        } catch (e) {
            // ignore. 'error' does not work on grpc-web implementation
        }
        return {
            _stream: stream,
            on: (ev, callback) => stream.on(ev, data => callback(BlockMetadata.fromGrpc(data))),
            cancel: () => stream.cancel()
        };
    }

    /**
     * Returns a stream that yields new events matching the specified filter in real-time.
     * 
     * .. code-block:: javascript
     * 
     *      const stream = aergo.getEventStream({
     *          address: 'Am....'
     *      });
     *      stream.on('data', (event) => {
     *         console.log(event);
     *         stream.cancel();
     *      });
     * 
     * @param {FilterInfo} filter :class:`FilterInfo`
     * @returns {Stream<Event>} event stream
     */
    getEventStream (filter: Partial<FilterInfo>): Stream<Event> {
        const fi = new FilterInfo(filter);
        const query = fi.toGrpc();
        const stream = this.client.client.listEventStream(query);
        try {
            stream.on('error', (error) => {
                if (error.code === 1) { // grpc.status.CANCELLED
                    return;
                }
            });
        } catch (e) {
            // ignore. 'error' does not work on grpc-web implementation
        }
        return {
            _stream: stream,
            on: (ev, callback) => stream.on(ev, data => callback(Event.fromGrpc(data))),
            cancel: () => stream.cancel()
        } as Stream<Event>;
    }
    
    
    /**
     * Retrieve account state, including current balance and nonce.
     * @param {string} address Account address encoded in Base58check
     * @returns {Promise<object>} account state
     */
    getState (address): Promise<State> {
        const singleBytes = new rpcTypes.SingleBytes();
        singleBytes.setValue(Uint8Array.from((new Address(address)).asBytes()));
        return promisify(this.client.client.getState, this.client.client)(singleBytes).then(grpcObject => State.fromGrpc(grpcObject));
    }
    
    getNonce(address): Promise<number> {
        const singleBytes = new rpcTypes.SingleBytes();
        singleBytes.setValue(Uint8Array.from((new Address(address)).asBytes()));
        return promisify(this.client.client.getState, this.client.client)(singleBytes).then(grpcObject => grpcObject.getNonce());
    }

    verifyTransaction (/*tx*/) {
        // Untested
        return promisify(this.client.client.verifyTX, this.client.client)()(grpcObject => Tx.fromGrpc(grpcObject));
    }

    /**
     * Send a signed transaction to the network.
     * @param {Tx} tx signed transaction
     * @returns {Promise<string>} transaction hash
     */
    sendSignedTransaction (tx): Promise<string> {
        return new Promise((resolve, reject) => {
            const txs = new rpcTypes.TxList();
            if (!(tx instanceof Tx)) {
                tx = new Tx(tx);
            }
            txs.addTxs(tx.toGrpc(), 0);
            this.client.client.commitTX(txs, (err: Error, result: CommitResultList) => {
                if (err == null && result.getResultsList()[0].getError()) {
                    const obj = result.getResultsList()[0].toObject();
                    err = new TransactionError(errorMessageForCode(obj.error) + ': ' + obj.detail);
                }
                if (err) {
                    reject(new TransactionError(err.message));
                } else {
                    resolve(encodeTxHash(result.getResultsList()[0].getHash_asU8()));
                }
            });
        });
    }

    /**
     * Return the top voted-for block producer
     * @param count number
     */
    getTopVotes(count: number, id: string = "voteBP"): Promise<any> {
        const params = new VoteParams();
        params.setCount(count);
        params.setId(id);
        return promisify(this.client.client.getVotes, this.client.client)(params).then(
            state => state.getVotesList().map((item: Vote) => ({
                amount: new Amount(item.getAmount_asU8()),
                candidate: bs58.encode(Buffer.from(item.getCandidate_asU8()))
            }))
        );
    }

    /**
     * Return information for account name
     * @param {string} address Account address encoded in Base58check
     */
    getStaking (address) {
        const singleBytes = new rpcTypes.SingleBytes();
        singleBytes.setValue(Uint8Array.from((new Address(address)).asBytes()));
        return promisify(this.client.client.getStaking, this.client.client)(singleBytes).then(
            (grpcObject: Staking) => {
                return {
                    amount: new Amount(grpcObject.getAmount_asU8()),
                    when: grpcObject.getWhen()
                };
            }
        );
    }

    /**
     * Retrieve the transaction receipt for a transaction
     * @param {string} txhash transaction hash
     * @return {Promise<object>} transaction receipt
     */
    getTransactionReceipt (txhash): Promise<GetReceiptResult> {
        const singleBytes = new rpcTypes.SingleBytes();
        singleBytes.setValue(Uint8Array.from(decodeTxHash(txhash)));
        return promisify(this.client.client.getReceipt, this.client.client)(singleBytes).then((grpcObject: GrpcReceipt) => {
            const obj = grpcObject.toObject();
            return {
                contractaddress: new Address(grpcObject.getContractaddress_asU8()),
                result: obj.ret,
                status: obj.status,
                fee: new Amount(grpcObject.getFeeused_asU8()),
                cumulativefee: new Amount(grpcObject.getCumulativefeeused_asU8()),
                blockno: obj.blockno,
                blockhash: Block.encodeHash(grpcObject.getBlockhash_asU8()),
            };
        });
    }

    /**
     * Query contract ABI
     * @param {FunctionCall} functionCall call details
     * @returns {Promise<object>} result of query
     */
    queryContract (functionCall: FunctionCall) {
        const query = functionCall.toGrpc();
        return promisify(this.client.client.queryContract, this.client.client)(query).then(
            grpcObject => JSON.parse(Buffer.from(grpcObject.getValue()).toString())
        );
    }

    /**
     * Query contract state
     * This only works vor variables explicitly defines as state variables.
     * @param {StateQuery} stateQuery query details obtained from contract.queryState()
     * @returns {Promise<object>} result of query
     */
    queryContractState (stateQuery: StateQuery) {
        const query = stateQuery.toGrpc();
        return promisify(this.client.client.queryContractState, this.client.client)(query).then(
            (grpcObject: StateQueryProof) => {
                const list = grpcObject.getVarproofsList();
                if (list.length === 0) return null;
                if (list.length === 1) {
                    const varProof = list[0];
                    if (varProof.getInclusion() === false) {
                        const addr = new Address(query.getContractaddress_asU8());
                        throw Error(`queried variable ${query.getStoragekeysList()[0]} does not exist in state at address ${addr.toString()}`);
                    }
                    const value = varProof.getValue_asU8();
                    if (value.length > 0) {
                        return JSON.parse(Buffer.from(value).toString());
                    }
                }
                return list.map(varProof => {
                    const value = varProof.getValue_asU8();
                    if (value.length > 0) {
                        return JSON.parse(Buffer.from(value).toString());
                    }
                    return void 0;
                });
            }
        );
    }

    /**
     * Query contract state
     * This only works vor variables explicitly defines as state variables.
     * @param {FilterInfo} filter :class:`FilterInfo`
     * @returns {Event[]} list of events
     */
    getEvents (filter: Partial<FilterInfo>): Event[] {
        const fi = new FilterInfo(filter);
        const query = fi.toGrpc();
        return promisify(this.client.client.listEvents, this.client.client)(query).then(
            (grpcObject: EventList) => {
                const list = grpcObject.getEventsList();
                return list.map(item => Event.fromGrpc(item));
            }
        );
    }

    /**
     * Query contract ABI
     * @param {string} address of contract
     * @returns {Promise<object>} abi
     */
    getABI (address) {
        const singleBytes = new rpcTypes.SingleBytes();
        singleBytes.setValue(Uint8Array.from((new Address(address)).asBytes()));
        return promisify(this.client.client.getABI, this.client.client)(singleBytes).then(
            (grpcObject: GrpcABI) => {
                const obj = grpcObject.toObject();
                return {
                    language: obj.language,
                    version: obj.version,
                    functions: obj.functionsList.map(item => ({
                        name: item.name,
                        arguments: item.argumentsList,
                        view: item.view,
                        payable: item.payable
                    })),
                    state_variables: obj.stateVariablesList
                };
            }
        );
    }

    /**
     * Get list of peers of connected node
     */
    getPeers (showself = true, showhidden = true) {
        const query = new PeersParams();
        query.setNohidden(!showhidden);
        query.setShowself(showself);
        return promisify(this.client.client.getPeers, this.client.client)(query).then(
            (grpcObject: GrpcPeerList): Array<Peer> => grpcObject.getPeersList().map(
                (peer: GrpcPeer): Peer => Peer.fromGrpc(peer)
            )
        );
    }

    /**
     * Return information for account name
     * @param name 
     */
    getNameInfo (name): Promise<NameInfoResult> {
        const nameObj = new Name();
        nameObj.setName(name);
        return promisify(this.client.client.getNameInfo, this.client.client)(nameObj).then(
            (grpcObject: NameInfo): NameInfoResult => {
                const obj = grpcObject.toObject();
                return {
                    name: obj.name.name,
                    owner: new Address(grpcObject.getOwner_asU8()),
                    destination: new Address(grpcObject.getDestination_asU8())
                };
            }
        );
    }

    /**
     * Return consensus info. The included fields can differ by consensus type.
     */
    getConsensusInfo (): Promise<ConsensusInfoResult> {
        return waterfall([
            marshalEmpty,
            this.grpcMethod<Empty, ConsensusInfo>(this.client.client.getConsensusInfo),
            async function unmarshal(response: ConsensusInfo): Promise<ConsensusInfoResult> {
                const obj = response.toObject();
                const result: ConsensusInfoResult = {
                    type: obj.type,
                    info: obj.info ? JSON.parse(obj.info) : {},
                    bpsList: obj.bpsList.map(info => JSON.parse(info))
                };
                return result;
            }
        ])(null);
    }

    /**
     * Return server info
     */
    getServerInfo (keys?: string[]): Promise<ServerInfoResult> {
        return waterfall([
            async function marshal(keys?: string[]): Promise<KeyParams> {
                const params = new KeyParams();
                if (typeof keys !== 'undefined') {
                    params.setKeyList(keys);
                }
                return params;
            },
            this.grpcMethod<KeyParams, ServerInfo>(this.client.client.getServerInfo),
            async function unmarshal(response: ServerInfo): Promise<ServerInfoResult> {
                const obj = response.toObject();
                const result: ServerInfoResult = {
                    configMap: new Map<string, Map<string, string>>(),
                    statusMap: new Map<string, string>(obj.statusMap)
                };
                const configMap = new Map(obj.configMap);
                for (const [key, item] of configMap) {
                    result.configMap.set(key, new Map(item.propsMap));
                }
                return result;
                
            }
        ])(keys);
    }
}

export default AergoClient;