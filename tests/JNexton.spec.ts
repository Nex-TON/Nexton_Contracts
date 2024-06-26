import { Blockchain, SandboxContract, TreasuryContract } from '@ton/sandbox';
import { toNano, Address, Cell, Dictionary, beginCell, TupleItemInt } from '@ton/core';
import '@ton/test-utils';
import { NftCollection } from '../wrappers/NftCollection';
import { NftItem } from '../wrappers/NftItem';
import { JNexTon } from '../wrappers/JNexton';
import { JettonWallet } from '../wrappers/jettonWallet';
import { JettonMinter } from '../wrappers/jettonMinter';
import { buildCollectionContentCell, toSha256 } from '../scripts/contentUtils/onChain';
import { randomAddress } from '@ton/test-utils';
import { compile } from '@ton/blueprint';

describe('JNexton', () => {
    let code: Cell;

    beforeAll(async () => {
        code = await compile('NftCollection');
    }, 10000);

    let blockchain: Blockchain;
    let jNexton: SandboxContract<JNexTon>;
    let nftCollection: SandboxContract<NftCollection>;
    let nftItem: SandboxContract<NftItem>;
    let jettonMinter: SandboxContract<JettonMinter>;
    let deployer: SandboxContract<TreasuryContract>;
    let user: SandboxContract<TreasuryContract>;

    let myAddress: Address = Address.parse("kQAXUIBw-EDVtnCxd65Z2M21KTDr07RoBL6BYf-TBCd6dTBu");
    

    const nextonSetup = {
        ownerAddress: myAddress,
        lockPeriod: 5184000,
        userDeposit: BigInt(1e6),
        protocolFee: toNano("0.1"),
    }

    beforeEach(async () => {
        blockchain = await Blockchain.create();

        blockchain = await Blockchain.create();
        deployer = await blockchain.treasury('deployer');
        user = await blockchain.treasury('user');
        // create nft collection
        nftCollection = blockchain.openContract(await NftCollection.createFromConfig({
            ownerAddress: deployer.address,
            nextItemIndex: 0,
            collectionContent: buildCollectionContentCell({
                name: "JCollection name",
                description: "Collection description",
                image: "https://hipo.finance/hton.png"
            }),
            nftItemCode: await compile("NftItem"),
            royaltyParams: {
                royaltyFactor: 15,
                royaltyBase: 100,
                royaltyAddress: deployer.address
            }
        }, code));

        const nftCollectionDeployResult = await nftCollection.sendDeploy(deployer.getSender(), toNano('0.1'));

        expect(nftCollectionDeployResult.transactions).toHaveTransaction({
            from: deployer.address,
            to: nftCollection.address,
            deploy: true,
            success: true,
        });

        jettonMinter = blockchain.openContract(await JettonMinter.createFromConfig({
            admin: deployer.address,
            content: buildCollectionContentCell({
                name: "Jetton name",
                description: "Jetton description",
                image: "https://hipo.finance/hton.png"
            }),
            wallet_code: await compile("JettonWallet"),
        }, await compile("JettonMinter")));

        const jettonMinterDeployResult = await jettonMinter.sendDeploy(deployer.getSender(), toNano('0.1'));    

        expect(jettonMinterDeployResult.transactions).toHaveTransaction({
            from: deployer.address,
            to: jettonMinter.address,
            deploy: true,
            success: true,
        });

        const mintTx = await jettonMinter.sendMint(
            deployer.getSender(),
            user.address,
            0n,
            BigInt(2e6),
            toNano('0.1'),
            toNano('0.3'),
        );

        const userWalletAddr = await jettonMinter.getWalletAddress(user.address);

        const userWallet = blockchain.openContract(await JettonWallet.createFromAddress(userWalletAddr));

        expect(await userWallet.getJettonBalance()).toEqual(nextonSetup.userDeposit * 2n);

        jNexton = blockchain.openContract(await JNexTon.fromInit(await compile("NftItem"), nftCollection.address, await compile("JettonWallet"), jettonMinter.address));

        const deployResult = await jNexton.send(
            deployer.getSender(),
            {
                value: toNano('0.5'),
            },
            {
                $$type: 'Deploy',
                queryId: 0n,
            }
        );

        expect(deployResult.transactions).toHaveTransaction({
            from: deployer.address,
            to: jNexton.address,
            deploy: true,
            success: true,
        });

        console.log("Deployed JNexton ", deployResult.events)
        console.log("JettonMinter ", jettonMinter.address)
        console.log("deployer ", deployer.address)
        // expect(deployResult.transactions).toHaveTransaction({
        //     from: jNexton.address,
        //     to: jettonMinter.address,
        // });

        const jNextonOwner = await jNexton.getOwner();

        await jNexton.send(
            deployer.getSender(),
            {
                value: toNano("50")
            },
            null
        )

        expect(jNextonOwner).toEqualAddress(deployer.address);

        await nftCollection.sendChangeOwner(deployer.getSender(),{
            value: toNano("0.02"),
            newOwnerAddress: jNexton.address,
            queryId: BigInt(Date.now())
        });

        // checkng nft collection data
        const collectionData = await nftCollection.getCollectionData();
        const contentS = collectionData.collectionContent.beginParse();
        const outPrefix = contentS.loadUint(8);
        expect(outPrefix).toEqual(0);
        const metadataDict = contentS.loadDict(Dictionary.Keys.BigUint(256), Dictionary.Values.Cell());
        
        const collectionNameS = await metadataDict.get(toSha256("name"))?.beginParse();
        const inPrefix = collectionNameS?.loadUint(8);
        expect(inPrefix).toEqual(0);
        const collectionName = collectionNameS?.loadStringTail();
        expect(collectionData.ownerAddress).toEqualAddress(jNexton.address);
        expect(collectionName).toMatch("JCollection name");
        expect(collectionData.nextItemId).toEqual(0n);

        // checking jNexton data
        expect(await jNexton.getJettonAddress()).toEqualAddress(jettonMinter.address);
        expect(await jNexton.getCollectionAddress()).toEqualAddress(nftCollection.address);
        // expect(await jNexton.getMyJettonWallet()).toEqualAddress(await jettonMinter.getWalletAddress(jNexton.address));
    });

    it('should deploy', async () => {
        // the check is done inside beforeEach
        // blockchain and jNexton are ready to use
    });

    it('Should Deposit and Mint NFT with set metadata', async() => {

        //console.log("User Depositing!!!");
        
        //const user = await blockchain.treasury('user');

        const userWalletAddr = await jettonMinter.getWalletAddress(user.address);

        const userWallet = blockchain.openContract(await JettonWallet.createFromAddress(userWalletAddr));

        const depositMessage = await userWallet.sendTransfer(
            user.getSender(),
            toNano("0.05"),
            nextonSetup.userDeposit,
            jNexton.address,
            user.address,
            beginCell().storeStringTail("Deposited to JNexton").endCell(),
            toNano("0.3"),
            beginCell().endCell(),
        );
        
        const index: TupleItemInt = {
            type: "int",
            value: 0n
        }

        const itemAddress =  await nftCollection.getItemAddressByIndex(index);

        expect(depositMessage.transactions).toHaveTransaction({
            from: nftCollection.address,
            to: itemAddress,
            inMessageBounced: false
        });
        //console.log(mintMessage.events);
        expect(depositMessage.events.at(-1)?.type).toMatch("account_created");
        expect(await jNexton.getNftCounter()).toEqual(1n);

        //console.log(await mintMessage.transactions);
        nftItem = blockchain.openContract(NftItem.createFromAddress(itemAddress));
        expect(nftItem.address).toEqualAddress(itemAddress);

        //console.log(nftItem.address, itemAddress)
        const itemData = await nftItem.getItemData();
        expect(itemData.index).toEqual(0n);
        const itemContentSlice = itemData.itemContent.beginParse();
        //console.log("refs ", itemContentSlice.remainingRefs);
        expect(itemContentSlice.remainingRefs).toEqual(1);

        const outPrefix = itemContentSlice.loadUint(8);
        expect(outPrefix).toEqual(0);
        
        const dict = itemContentSlice.loadDict((Dictionary.Keys.BigUint(256)), Dictionary.Values.Cell());
        const nameCell = dict.get(toSha256("name"));
        const nameS = nameCell?.beginParse();
        nameS?.loadUint(8);
        const name = nameS?.loadStringTail();
        expect(name).toMatch("Nexton Staking Derivative");
        // const descriptionCell = dict.get(toSha256("description"));
        // const imageCell = dict.get(toSha256("image"));
        const principalCell = dict.get(toSha256("principal"));
        // const leverageCell = dict.get(toSha256("leverage"));
        //const lockPeriodCell = dict.get(toSha256("lockPeriod"));
        const lockEndCell = dict.get(toSha256("lockEnd"));
        const pr = principalCell?.beginParse()!!;
        pr.loadUint(8);
        const principal = pr.loadCoins();
        // console.log("principal ", principal);
        expect(principal).toEqual(nextonSetup.userDeposit - nextonSetup.protocolFee);

        const le = lockEndCell?.beginParse()!!;
        le.loadUint(8)
        const lockEnd = le.loadUint(256)
        // console.log("Now ", Math.floor(Date.now() / 1000));
        // console.log("lockEnd ", lockEnd);
        expect(Math.floor(Date.now() / 1000) + Number(nextonSetup.lockPeriod)).toEqual(lockEnd);
        
    });

});
