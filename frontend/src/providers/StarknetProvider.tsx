"use client";

import React from "react";
import { sepolia } from "@starknet-react/chains";
import {
    StarknetConfig,
    publicProvider,
    argent,
    braavos,
    useInjectedConnectors,
} from "@starknet-react/core";

function StarknetProviderInner({ children }: { children: React.ReactNode }) {
    const { connectors } = useInjectedConnectors({
        recommended: [argent(), braavos()],
        includeRecommended: "onlyIfNoConnectors",
        order: "random",
    });

    return (
        <StarknetConfig
            chains={[sepolia]}
            provider={publicProvider()}
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
