/*
 * Copyright 2018 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     https://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import * as jsdiff from 'diff';
import * as fs from 'fs';
import * as vscode from 'vscode';

const charactersPerChange = 5;
const heartbeatInterval = 33;

export class Animator {
  private editor: vscode.TextEditor;
  private contentPath: string;
  private target = 'not loaded yet';
  private running = false;

  constructor(editor: vscode.TextEditor, contentPath: string) {
    this.editor = editor;
    this.contentPath = contentPath;
  }

  public start() {
    this.running = true;
    vscode.workspace.findFiles(this.contentPath).then((uri) => {
      fs.readFile(uri[0].fsPath, 'UTF-8', (err, contents) => {
        if (err) {
          vscode.window.showErrorMessage(
            `Failed to read ${this.contentPath}: ${err}`,
          );
          return;
        }
        this.target = contents;
        setTimeout(() => {
          this.heartbeat();
        }, heartbeatInterval);
      });
    });
  }
  public stop() {
    this.running = false;
  }

  private heartbeat() {
    if (!this.running) {
      return;
    }
    const { document } = this.editor;
    const fullText = document.getText();
    const diffs = jsdiff.diffChars(fullText, this.target);
    let cursor = 0;
    let changed = false;
    diffs.forEach((diff) => {
      if (changed) {
        return;
      }
      if (diff.added) {
        this.editor.edit((editBuilder) => {
          const change = diff.value.substring(0, charactersPerChange);
          editBuilder.insert(document.positionAt(cursor), change);
          changed = true;
        });
      } else if (diff.removed) {
        this.editor.edit((editBuilder) => {
          const range = new vscode.Range(
            document.positionAt(cursor),
            document.positionAt(cursor + diff.value.length),
          );
          editBuilder.delete(range);
          changed = true;
        });
      } else {
        cursor += diff.value.length;
      }
    });
    if (!changed) {
      this.running = false;
      document.save();
    }
    setTimeout(() => {
      this.heartbeat();
    }, heartbeatInterval);
  }
}
