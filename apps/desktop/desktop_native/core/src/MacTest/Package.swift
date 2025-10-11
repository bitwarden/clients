
// swift-tools-version: 5.8
// The swift-tools-version declares the minimum version of Swift required to build this package.

import PackageDescription

let package = Package(
    name: "MacTest",
    platforms: [
        .macOS(.v12)
    ],
    products: [
        .library(
            name: "MacTest",
            type: .static,
            targets: ["MacTest"]),
    ],
    dependencies: [
        .package(url: "https://github.com/Brendonovich/swift-rs", from: "1.0.5")
    ],
    targets: [
        .target(
            name: "MacTest",
            dependencies: [
                .product(
                    name: "SwiftRs",
                    package: "swift-rs"
                ),
            ]),
    ]
)