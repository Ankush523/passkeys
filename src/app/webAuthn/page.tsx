"use client";
import { FC, useCallback, useEffect, useState } from "react";
import { client, parsers } from "@passwordless-id/webauthn";
import { AuthenticationParsed } from "@passwordless-id/webauthn/dist/esm/types";
import styles from "./webAuthn.module.css";
import "../globals.css";
export const WebAuthPage: FC = () => {
  const [username, setUsername] = useState<string>(
    window.localStorage.getItem("username") || ""
  );

  const isClientAvailable = client.isAvailable();

  // Registration

  const [isRegistered, setIsRegistered] = useState(false);
  const challenge =
    window.localStorage.getItem("challenge_" + username) ||
    window.crypto.randomUUID();

  const checkIsRegistered = useCallback(async () => {
    setIsRegistered(!!window.localStorage.getItem("credential_" + username));
  }, [username]);

  useEffect(() => {
    if (username) {
      checkIsRegistered();
    }
  }, [checkIsRegistered, username]);

  const register = useCallback(async () => {
    const res = await client.register(username, challenge, {
      authenticatorType: "auto",
      userVerification: "required",
      timeout: 60000,
      attestation: false,
      debug: false,
    });
    const parsed = parsers.parseRegistration(res);
    window.localStorage.setItem("username", username);
    window.localStorage.setItem("credential_" + username, parsed.credential.id);
    window.localStorage.setItem("challenge_" + username, challenge);
    checkIsRegistered();
  }, [challenge, checkIsRegistered, username]);


  const getAllStoredCredentials = (): string[] => {
    const allKeys = Object.keys(window.localStorage);
    const credentialKeys = allKeys.filter(key => key.startsWith('credential_'));
    return credentialKeys.map(key => window.localStorage.getItem(key) || "");
  }

  // Login

  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authenticationData, setAuthenticationData] =
    useState<AuthenticationParsed | null>(null);

    const login = useCallback(async () => {
      let credentials = [window.localStorage.getItem("credential_" + username) || ""];
      // If no username is provided, get all credentials
      if (!username) {
        credentials = getAllStoredCredentials();
      }
      const res = await client.authenticate(
        credentials,
        challenge,
        {
          authenticatorType: "auto",
          userVerification: "required",
          timeout: 60000,
        }
      );
      const parsed = parsers.parseAuthentication(res);
      if (!username) {
        // If we had no username, try to deduce it from the authenticated credential.
        const usernameKey = Object.keys(window.localStorage).find(
          key => window.localStorage.getItem(key) === parsed.credentialId
        );
        if (usernameKey) {
          setUsername(usernameKey.replace("credential_", ""));
        }
      }
      setIsAuthenticated(true);
      setAuthenticationData(parsed);
  }, [challenge, username]);
  

  return (
    <div className={styles.form}>
      <p className="row-between">
        <b className={styles.text}>Status:</b>
        {username.length > 1 ? (
          <b className={styles.text}>You have an account already</b>
        ) : (
          <b className={styles.text}>You dont have account yet</b>
        )}
      </p>

      <p className="row-between">
        <b className={styles.text}>Username:</b>{" "}
        <input
          className={`${styles.input} `}
          value={username}
          onChange={(e) => setUsername(e.target.value)}
        />
      </p>

      <p className="row">
        <button
          className={isRegistered ? styles.button2 : styles.button}
          disabled={isRegistered || !!authenticationData}
          onClick={register}
        >
          Register
        </button>
        <span style={{ width: 300 }}> </span>
        <button
          className={styles.button}
          disabled={!isRegistered || !!authenticationData}
          onClick={login}
        >
          Login
        </button>
      </p>

      {authenticationData && (
        <>
          <p className="row-between">
            <h3 className={styles.text}>Clear Data</h3>
            <button
              className={styles.button}
              onClick={() => {
                setUsername("");
                setAuthenticationData(null);
              }}
            >
              Clear
            </button>
          </p>
          <h3 className={styles.text}>AuthenticationData</h3>
          <pre className={styles.data}>
            <code aria-multiline={true}>
              {JSON.stringify(authenticationData, null, 2)}
            </code>
          </pre>
        </>
      )}
    </div>
  );
};