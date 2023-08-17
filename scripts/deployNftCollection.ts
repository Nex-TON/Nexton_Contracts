import { Address, Dictionary, beginCell, toNano, Cell } from 'ton-core';
import { NftCollection, buildNftCollectionContentCell, NftCollectionContent } from '../wrappers/NftCollection';
import { compile, NetworkProvider } from '@ton-community/blueprint';
import { sha256_sync } from 'ton-crypto'

let myAddress: Address = Address.parse("kQAXUIBw-EDVtnCxd65Z2M21KTDr07RoBL6BYf-TBCd6dTBu");

function toSha256(s: string): bigint {
    return BigInt('0x' + sha256_sync(s).toString('hex'))
}

function toTextCell(s: string): Cell {
    return beginCell().storeUint(0, 8).storeStringTail(s).endCell()
}

const collectionContentDict = Dictionary.empty(Dictionary.Keys.BigUint(256), Dictionary.Values.Cell())
    .set(toSha256("name"), toTextCell("NexTon User"))
    .set(toSha256("description"), toTextCell("Nfts proving users' deposits"))
    .set(toSha256("image"), toTextCell(""));

const commonContentDict = Dictionary.empty(Dictionary.Keys.BigUint(256), Dictionary.Values.Cell())
    .set(toSha256("name"), toTextCell("NexTon User"))
    .set(toSha256("description"), toTextCell("Nfts proving users' deposits"))
    .set(toSha256("image"), toTextCell(""));

console.log(collectionContentDict)

const content = beginCell().storeUint(0, 8).storeDict(collectionContentDict).endCell()

export async function run(provider: NetworkProvider) {
    const nftCollection = provider.open(NftCollection.createFromConfig({
        ownerAddress: myAddress, 
        nextItemIndex: 0,
        collectionContent: content,
        nftItemCode: await compile("NftItem"),
        royaltyParams: {
            royaltyFactor: 5,
            royaltyBase: 100,
            royaltyAddress: provider.sender().address as Address
        }
    }, await compile('NftCollection')));

    console.log(provider.sender().address as Address)
    await nftCollection.sendDeploy(provider.sender(), toNano('0.05'));
    console.log()
    await provider.waitForDeploy(nftCollection.address);
}
