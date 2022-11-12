import * as core from "@actions/core";
import fetch from "node-fetch";

const NETLIFY_BASE_URL = `https://api.netlify.com/api/v1/`;
const STATE_READY = "ready";
const STATE_CURRENT = "current";
const STATE_ERROR = "error";
const WAIT_TIMEOUT = 60 * 15; // 15 min
const WAIT_INCREMENT = 15; // seconds

const netlifyFetch = async (netlifyToken, url, data) => {
  let response = await fetch(NETLIFY_BASE_URL + url, {
    ...data,
    ...{ headers: { Authorization: `Bearer ${netlifyToken}` } },
  });

  if (response.status >= 400) {
    throw new Error(response.statusText);
  }

  return await response.json();
};

const getDeployFromId = async (inputs, deployId) => {
  return await netlifyFetch(
    inputs.netlifyToken,
    `sites/${inputs.siteId}/deploys/${deployId}`
  );
};

const createBuild = async (inputs) => {
  core.info(`Deploying branch '${inputs.branch}'.`);

  return await netlifyFetch(
    inputs.netlifyToken,
    `sites/${inputs.siteId}/builds`,
    {
      method: "POST",
      body: { clear_cache: false },
    }
  );
};

const isDeployReady = (deploy) => {
  return deploy.state === STATE_READY;
};

const hasDeployFailed = (deploy) => {
  return deploy.state === STATE_ERROR;
};

const waitForDeployToBeReady = async (inputs, deployId) => {
  let waitTime = 0;

  core.info(
    `Production deploy for branch '${inputs.branch}' is not ready yet.\n` +
      `Waiting ${WAIT_INCREMENT} more seconds for the deploy for branch to finish.`
  );

  const handle = setInterval(async () => {
    waitTime += WAIT_INCREMENT;

    if (waitTime >= WAIT_TIMEOUT) {
      clearInterval(handle);
      core.setFailed(
        `Wait for production deploy for branch '${inputs.branch}' timed out ` +
          `after ${WAIT_TIMEOUT / 60} minutes.`
      );
      return;
    }

    const deploy = await getDeployFromId(inputs, deployId);

    if (isDeployReady(deploy)) {
      clearInterval(handle);
      core.info(`Production deploy for branch '${inputs.branch}' is ready.`);
      return;
    }

    if (hasDeployFailed(deploy)) {
      clearInterval(handle);
      core.setFailed(
        `Production deploy for branch '${inputs.branch}' has failed with the ` +
          `error message: ${deploy.error_message}.`
      );
      return;
    }

    core.info(
      `Waiting ${WAIT_INCREMENT} more seconds for the deploy for branch ` +
        `'${inputs.branch}' to finish.`
    );
  }, WAIT_INCREMENT * 1000);
};

const run = async () => {
  try {
    const inputs = {
      netlifyToken: core.getInput("netlifyToken"),
      siteId: core.getInput("siteId"),
      branch: core.getInput("branch"),
    };

    core.setSecret("netlifyToken");

    const { deploy_id: deployId } = await createBuild(inputs);
    core.setOutput("deploy_id", deployId);

    await waitForDeployToBeReady(inputs, deployId);
  } catch (error) {
    core.setFailed(error.message);
  }
};

run();
