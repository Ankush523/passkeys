"use client";
import { FC, useCallback, useEffect, useState } from "react";
import { client, parsers } from "@passwordless-id/webauthn";
import { AuthenticationParsed } from "@passwordless-id/webauthn/dist/esm/types";
import styles from "./webAuthn.module.css";
import Wallet from 'ethereumjs-wallet';
import "../globals.css";
export const WebAuthPage: FC = () => {

  const [username, setUsername] = useState<string>(
    window.localStorage.getItem("username") || ""
  );

  const [walletAddress, setWalletAddress] = useState<string | null>(
    window.localStorage.getItem("wallet_" + username) || null
  );
  

  const isClientAvailable = client.isAvailable();

  // Wallet generation

  const generateEthereumWallet = () => {
    const wallet = Wallet.generate();
    return {
      address: `0x${wallet.getAddress().toString('hex')}`,
      privateKey: wallet.getPrivateKeyString(),
    };
  }
  

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
    console.log(res);

    if (res) {
      // Generate Ethereum wallet and store it in localStorage
      const { address, privateKey } = generateEthereumWallet();
      window.localStorage.setItem("walletAddress_" + username, address);
      window.localStorage.setItem("walletPrivateKey_" + username, privateKey);
    }

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
    
      // If we had no username, try to deduce it from the authenticated credential.
      if (!username) {
        const usernameKey = Object.keys(window.localStorage).find(
          key => window.localStorage.getItem(key) === parsed.credentialId
        );
        if (usernameKey) {
          const deducedUsername = usernameKey.replace("credential_", "");
          setUsername(deducedUsername); 
    
          // Fetch the wallet address using the newly deduced username
          const address = window.localStorage.getItem("walletAddress_" + deducedUsername);
          if (address) {
            setWalletAddress(address);
          }
        }
      } else {
        // If we already have a username, fetch the wallet address.
        const address = window.localStorage.getItem("walletAddress_" + username);
        if (address) {
          setWalletAddress(address);
        }
      }
    
      setIsAuthenticated(true);
      setAuthenticationData(parsed);
    }, [challenge, username]);
    

  //Sign out
  const handleSignOut = () => {
    // Clear user session and state
    setUsername("");
    setIsAuthenticated(false);
    setAuthenticationData(null);
    setWalletAddress(null);
  
    // Optionally, you can also clear local storage if needed
    // window.localStorage.clear(); 
    // OR selectively:
    // window.localStorage.removeItem("username");
    // ... remove any other items as necessary ...
  };
  
  

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

      {walletAddress && (
      <p className="row-between">
        <b className={styles.text}>Wallet Address:</b>{" "}
        <span>{walletAddress}</span>
      </p>
    )}

    {isAuthenticated && (
      <button className={styles.button} onClick={handleSignOut}>
        Sign Out
      </button>
    )}

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