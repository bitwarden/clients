// swift-tools-version: 5.9
// The swift-tools-version declares the minimum version of Swift required to build this package.

import PackageDescription

let package = Package(
  name: "macos-swift",
  products: [
    .library(
      name: "macos-swift",
      type: .static,
      targets: ["macos-swift"])
  ],
  dependencies: [
    .package(url: "https://github.com/Brendonovich/swift-rs", from: "1.0.6")
  ],
  targets: [
    .target(
      name: "macos-swift",
      dependencies: [
        .product(
          name: "SwiftRs",
          package: "swift-rs"
        )
      ])
  ]
)
