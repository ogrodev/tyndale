// packages/tyndale/src/tui/provider-selector.ts

import {
  Container,
  Text,
  Spacer,
  TruncatedText,
  getKeybindings,
} from '@mariozechner/pi-tui';
import chalk from 'chalk';
import { InteractiveContainer, runTui } from './run-tui';

interface ProviderInfo {
  id: string;
  displayName: string;
  loggedIn: boolean;
  isOAuth: boolean;
}

/**
 * Full-screen TUI for selecting an AI provider.
 * Arrow keys navigate, Enter selects, Escape/Ctrl+C cancels.
 * Returns the selected provider ID, or null on cancel.
 */
export function selectProvider(providers: ProviderInfo[]): Promise<string | null> {
  return runTui<string>(({ resolve }) => {
    let selectedIndex = 0;

    const title = new Text(chalk.bold('Select provider to login:'), 0, 0);
    const listContainer = new Container();
    const hintText = new TruncatedText(
    chalk.dim('↑/↓ navigate  enter select  esc cancel'),
    0,
    0,
  );
  
  function updateList() {
    listContainer.children = [];
    for (let i = 0; i < providers.length; i++) {
      const p = providers[i];
      const isSelected = i === selectedIndex;
      const status = p.loggedIn ? chalk.green(' ✓ logged in') : '';
      let line: string;
      if (isSelected) {
        line = chalk.cyan('→ ') + chalk.cyan.bold(p.displayName) + status;
      } else {
        line = '  ' + p.displayName + status;
      }
      listContainer.addChild(new TruncatedText(line, 0, 0));
    }
  }
  
  updateList();
  
  const root = new InteractiveContainer();
  root.addChild(new Spacer(1));
  root.addChild(title);
  root.addChild(new Spacer(1));
  root.addChild(listContainer);
  root.addChild(new Spacer(1));
  root.addChild(hintText);
  
  root.handleInput = (keyData: string) => {
    const kb = getKeybindings();
    if (kb.matches(keyData, 'tui.select.up')) {
      selectedIndex = selectedIndex === 0 ? providers.length - 1 : selectedIndex - 1;
      updateList();
    } else if (kb.matches(keyData, 'tui.select.down')) {
      selectedIndex = selectedIndex === providers.length - 1 ? 0 : selectedIndex + 1;
      updateList();
    } else if (kb.matches(keyData, 'tui.select.confirm')) {
      resolve(providers[selectedIndex].id);
    } else if (kb.matches(keyData, 'tui.select.cancel')) {
      resolve(null);
    }
  };
  
  return root; });
}
