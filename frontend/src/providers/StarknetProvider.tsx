"use client";

import React from "react";
import { sepolia } from "@starknet-react/chains";
import {
    StarknetConfig,
    jsonRpcProvider,
    argent,
    braavos,
    useInjectedConnectors,
} from "@starknet-react/core";

const provider = jsonRpcProvider({
    rpc: (chain) => {
        const nodeUrl =
            chain.rpcUrls.public.http[0] ??
            chain.rpcUrls.default.http[0] ??
            chain.rpcUrls.cartridge?.http?.[0];

        if (!nodeUrl) {
            return null;
        }

        return { nodeUrl };
    },
});

function StarknetProviderInner({ children }: { children: React.ReactNode }) {
    const { connectors } = useInjectedConnectors({
        recommended: [argent(), braavos()],
        includeRecommended: "onlyIfNoConnectors",
        order: "random",
    });

    return (
        <StarknetConfig
            chains={[sepolia]}
            provider={provider}
            connectors={connectors}
        >
            {children}
        </StarknetConfig>
    );
}

export default function StarknetProvider({
    children,
}: {
    children: React.ReactNode;
}) {
    return <StarknetProviderInner>{children}</StarknetProviderInner>;
}
