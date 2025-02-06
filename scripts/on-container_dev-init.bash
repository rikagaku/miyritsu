#!/bin/bash
case "$1" in
    "--no-build")
    ;;
    *)
        #cargo run --bin prisma -- generate
    ;;
esac

rustup default stable

#cargo build

#lldb-server g 0.0.0.0:2129 -- /app/target/debug/ifhany

while true; do
    sleep 5;
done