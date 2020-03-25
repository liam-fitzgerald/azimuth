var Azimuth = artifacts.require("./Azimuth.sol");
var Polls = artifacts.require("./Polls.sol");
var Claims = artifacts.require("./Claims.sol");
var Censures = artifacts.require("./Censures.sol");
var Ecliptic = artifacts.require("./Ecliptic.sol");
var DelegatedSending = artifacts.require("./DelegatedSending.sol");
var LinearStarRelease = artifacts.require("./LinearStarRelease.sol");
var CSR = artifacts.require("./ConditionalStarRelease.sol");

const WITH_TEST_STATE = true; // process.argv[3] === "with-state";
const user1 = "0xD53208cf45fC9bd7938B200BFf8814A26146688f";
const windup = 20;
const rateUnit = 50;
const deadlineStep = 100;
const condit2 = web3.utils.fromAscii("1234");
let deadline1,
  deadline2,
  deadline3,
  deadline4,
  escapeHatchTime,
  escapeHatchDate;

async function getChainTime() {
  const block = await web3.eth.getBlock("latest");

  return block.timestamp;
}

module.exports = async function(deployer) {
  await deployer;

  // setup contracts
  const azimuth = await deployer.deploy(Azimuth);
  const polls = await deployer.deploy(Polls, 1209600, 604800);
  const claims = await deployer.deploy(Claims, azimuth.address);
  const censures = await deployer.deploy(Censures, azimuth.address);
  deadline1 = web3.utils.toDecimal(await getChainTime()) + 10;
  deadline2 = deadline1 + deadlineStep;
  deadline3 = deadline2 + deadlineStep;
  deadline4 = deadline3 + deadlineStep;
  escapeHatchTime = deadlineStep * 100;
  escapeHatchDate =
    web3.utils.toDecimal(await getChainTime()) + escapeHatchTime;

  //NOTE  for real deployment, use a real ENS registry
  const ecliptic = await deployer.deploy(
    Ecliptic,
    "0x0000000000000000000000000000000000000000",
    azimuth.address,
    polls.address,
    claims.address
  );

  // configure contract ownership
  await azimuth.transferOwnership(ecliptic.address);
  await polls.transferOwnership(ecliptic.address);

  // deploy secondary contracts
  const sending = await deployer.deploy(DelegatedSending, azimuth.address);
  console.log("g");
  console.log(condit2);
  console.log(deadline2);
  console.log(escapeHatchDate);
  const csr = await deployer.deploy(
    CSR,
    azimuth.address,
    ["0x0", condit2],
    [0, 0],
    [deadline1, deadline2],
    escapeHatchDate
  );
  console.log("f");
  // beyond this point: "default" state for qa & testing purposes
  if (!WITH_TEST_STATE) return;

  const own = await ecliptic.owner();
  await ecliptic.createGalaxy(0, own);
  await ecliptic.createGalaxy(1, own);
  console.log("g");
  await ecliptic.configureKeys(0, "0x123", "0x456", 1, false);
  await ecliptic.configureKeys(1, "0x123", "0x456", 1, false);
  await ecliptic.spawn(256, own);
  // set transfer proxy to delegated sending, very brittle
  const lsr = await deployer.deploy(LinearStarRelease, azimuth.address);
  console.log("lsr");
  lsr.startReleasing();
  await ecliptic.setSpawnProxy(0, lsr.address);
  await ecliptic.setSpawnProxy(1, csr.address);
  await ecliptic.configureKeys(256, "0x123", "0x456", 1, false);
  await ecliptic.setSpawnProxy(256, sending.address);
  await ecliptic.spawn(65792, own);
  await lsr.register(user1, windup, 8, 2, rateUnit);
  await sending.setPoolSize(256, 65792, 1000);
  console.log("Registered LSR");
  await csr.register(user1, [4, 1], 1, rateUnit);
  console.log("registered CSR");

  for (let i = 2; i < 100; i++) {
    // await ecliptic.spawn(256 * i, user1);
    const offset = 65536 * i;
    console.log(`offset: ${offset}`);
    await ecliptic.spawn(offset + 256, own);
    await ecliptic.transferPoint(offset + 256, user1, false);
    console.log(`deposited: ${offset}`);
    console.log(`deposited: ${offset + 1}`);
  }
};
