import * as core from "@actions/core";
import fetch from "node-fetch";

const NETLIFY_BASE_URL = `https://api.netlify.com/api/v1/`;
const READY_STATES = ["ready", "current"];
const WAIT_TIMEOUT = 60 * 15; // 15 min
const WAIT_INCREMENT = 30; // 30 seconds

const netlifyFetch = async (netlifyToken, url) => {
  return await fetch(NETLIFY_BASE_URL + url, {
    headers: {
      Authorization: `Bearer ${netlifyToken}`,
    },
  }).then((response) => response.json());
};

const getDeploy = async (inputs) => {
  const deploys = await netlifyFetch(
    inputs.netlifyToken,
    `sites/${inputs.siteId}/deploys?branch=${inputs.branch}`
  );

  return deploys.find(
    (d) => d.context == "production" && d.commit_ref == inputs.commitSha
  );
};

const isDeployReady = (deploy) => {
  return READY_STATES.includes(deploy.state);
};

const waitForDeployToBeReady = async (inputs, deploy) => {
  let waitTime = 0;

  core.info(
    `Production deploy for branch '${inputs.branch}' (sha: ${inputs.commitSha}) ` +
      `is not ready yet.\nWaiting ${WAIT_INCREMENT} more seconds for the ` +
      `deploy to finish.`
  );

  const handle = setInterval(
    async (inputs, deployId) => {
      waitTime += WAIT_INCREMENT;

      if (waitTime >= WAIT_TIMEOUT) {
        clearInterval(handle);
        core.setFailed(
          `Wait for production deploy for branch '${inputs.branch}' ` +
            `(sha: ${inputs.commitSha}) timed out after ` +
            `${WAIT_TIMEOUT / 60} minutes.`
        );
        return;
      }

      const deploy = await netlifyFetch(
        inputs.netlifyToken,
        `sites/${inputs.siteId}/deploys/${deployId}`
      );

      if (isDeployReady(deploy)) {
        clearInterval(handle);
        core.info(
          `Production deploy for branch '${inputs.branch}' (sha: ${inputs.commitSha}) is ready.`
        );
        return;
      }

      core.info(
        `Waiting ${WAIT_INCREMENT} more seconds for the deploy to finish.`
      );
    },
    WAIT_INCREMENT * 1000,
    inputs,
    deploy.id
  );
};

const run = async () => {
  try {
    const inputs = {
      netlifyToken: core.getInput("netlifyToken"),
      siteId: core.getInput("siteId"),
      branch: core.getInput("branch"),
      commitSha: core.getInput("commitSha"),
    };

    core.setSecret("netlifyToken");

    const deploy = await getDeploy(inputs);

    if (!deploy) {
      core.setFailed(
        `Production deploy for branch '${inputs.branch}' (sha: ${inputs.commitSha}) doesn't exist.`
      );
      return;
    }

    core.setOutput("deploy_id", deploy.id);
    core.setOutput("url", `https://${deploy.id}--${deploy.name}.netlify.app`);

    if (isDeployReady(deploy)) {
      core.info(
        `Production deploy for branch '${inputs.branch}' (sha: ${inputs.commitSha}) is ready.`
      );
      return;
    }

    await waitForDeployToBeReady(inputs, deploy);
  } catch (error) {
    core.setFailed(error.message);
  }
};

run();
