/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at <http://mozilla.org/MPL/2.0/>. */

// @flow

import { parse } from "../url";

import { nodeHasChildren } from "./utils";
import { isUrlExtension } from "../source";

import type { TreeNode } from "./types";

import type { Source } from "../../types";

export function getDomain(url?: string): ?string {
  // TODO: define how files should be ordered on the browser debugger
  if (!url) {
    return null;
  }
  const { host } = parse(url);
  if (!host) {
    return null;
  }
  return host.startsWith("www.") ? host.substr("www.".length) : host;
}

function isExactDomainMatch(part: string, debuggeeHost: string): boolean {
  return part.startsWith("www.")
    ? part.substr("www.".length) === debuggeeHost
    : part === debuggeeHost;
}

/*
 * Checks if node name matches Angular Bundler.
 */
function isAngularBundler(part: string): boolean {
  return part === "ng://";
}

/*
 * Checks if node name matches Webpack Bundler.
 */
function isWebpackBundler(part: string): boolean {
  return part === "webpack://";
}

/*
 * Function to assist with node search for a defined sorted order, see e.g.
 * `createTreeNodeMatcher`. Returns negative number if the node
 * stands earlier in sorting order, positive number if the node stands later
 * in sorting order, or zero if the node is found.
 */
export type FindNodeInContentsMatcher = (node: TreeNode) => number;

/*
 * Performs a binary search to insert a node into contents. Returns positive
 * number, index of the found child, or negative number, which can be used
 * to calculate a position where a new node can be inserted (`-index - 1`).
 * The matcher is a function that returns result of comparision of a node with
 * lookup value.
 */
export function findNodeInContents(
  tree: TreeNode,
  matcher: FindNodeInContentsMatcher
) {
  if (tree.type === "source" || tree.contents.length === 0) {
    return { found: false, index: 0 };
  }

  let left = 0;
  let right = tree.contents.length - 1;
  while (left < right) {
    const middle = Math.floor((left + right) / 2);
    if (matcher(tree.contents[middle]) < 0) {
      left = middle + 1;
    } else {
      right = middle;
    }
  }
  const result = matcher(tree.contents[left]);
  if (result === 0) {
    return { found: true, index: left };
  }
  return { found: false, index: result > 0 ? left : left + 1 };
}

const IndexName = "(index)";

/*
 * Check if part matches with any predetermined exceptions
 */
function matchWithException(part, debuggeeHost) {
  if (part === IndexName) {
    return true;
  }

  if (debuggeeHost && isExactDomainMatch(part, debuggeeHost)) {
    return true;
  }

  if (isAngularBundler(part)) {
    console.log(part);
    // return true;
  }

  if (isWebpackBundler(part)) {
    console.log(part);
    // return true;
  }

  if (isUrlExtension(part)) {
    return true;
  }
  
  return false;
}

export function createTreeNodeMatcher(
  part: string,
  isDir: boolean,
  debuggeeHost: ?string,
  source?: Source,
  sortByUrl?: boolean
): FindNodeInContentsMatcher {
  return (node: TreeNode) => {
    // Check if part and node.name are equal
    if (isExactDomainMatch(part, node.name)) {
      return 0;
    }

    // Check if node is an exception
    if (matchWithException(node.name, debuggeeHost)) {
      return -1;
    }

    // Check if part is an exception
    if (matchWithException(part, debuggeeHost)) {
      return 1;
    }

    // Sort directories before files
    const nodeIsDir = nodeHasChildren(node);
    if(!nodeIsDir === isDir) {
      return nodeIsDir && !isDir ? -1 : 1;
    }

    // Sort by url if files have the same name
    if (sortByUrl && node.type === "source" && source) {
      return node.contents.url.localeCompare(source.url);
    }

    // Compare locally
    return node.name.localeCompare(part);
  };
}