import "styles/globals.css";
import type { AppProps } from "next/app";
import React from "react";
import Head from "next/head";

export default function App({ Component, pageProps }: AppProps) {
  return (
    <Layout>
      <Head>
        <meta
          name="viewport"
          content="minimum-scale=1, initial-scale=1, width=device-width, shrink-to-fit=no, user-scalable=no, viewport-fit=cover, interactive-widget=resizes-content"
        />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta
          name="apple-mobile-web-app-status-bar-style"
          content="black-translucent"
        />
      </Head>
      <Component {...pageProps} />
    </Layout>
  );
}

const Layout: React.FC<React.PropsWithChildren<unknown>> = (props) => {
  return (
    <>
      <Head>
        <title key="title">mud</title>
      </Head>
      <div style={{ maxWidth: "48rem", margin: "auto", padding: "1rem" }}>
        {props.children}
      </div>
    </>
  );
};
