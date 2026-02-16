"use client";

import dynamic from "next/dynamic";
import React from "react";

const StarknetProvider = dynamic(
    () => import("@/providers/StarknetProvider"),
    { ssr: false }
);

export default function ClientProviders({
    children,
}: {
    children: React.ReactNode;
}) {
    return <StarknetProvider>{children}</StarknetProvider>;
}
