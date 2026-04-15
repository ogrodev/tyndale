// packages/tyndale/src/tui/model-selector.ts

import {
  Container,
  Input,
  Text,
  Spacer,
  TruncatedText,
  fuzzyFilter,
  getKeybindings,
} from '@mariozechner/pi-tui';
import chalk from 'chalk';
import { InteractiveContainer, runTui } from './run-tui';

interface ModelInfo {
  id: string;
  name: string;
  provider: string;
}

/**
 * Full-screen TUI for selecting a model.
 * Features: search-as-you-type filtering, provider tab cycling,
 * arrow key navigation, enter to select, escape to cancel.
 * Returns `provider/modelId` string, or null on cancel.
 */
export function selectModel(models: ModelInfo[]): Promise<string | null> {
  if (models.length === 0) {
    return Promise.resolve(null);
  }

  return runTui<string>(({ resolve }) => {
    const uniqueProviders = [...new Set(models.map((m) => m.provider))];
    const scopes = ['ALL', ...uniqueProviders];
    let scopeIndex = 0;
    let selectedIndex = 0;
    let filtered: ModelInfo[] = models;

    const searchInput = new Input();
  const scopeText = new Text('', 0, 0);
  const listContainer = new Container();
  const infoText = new Text('', 0, 0);
  const hintText = new TruncatedText(
    chalk.dim('↑/↓ navigate  enter select  tab provider  esc cancel'),
    0,
    0,
  );
  
  function getActiveModels(): ModelInfo[] {
    if (scopeIndex === 0) return models; // ALL
    const provider = scopes[scopeIndex];
    return models.filter((m) => m.provider === provider);
  }
  
  function applyFilter() {
    const active = getActiveModels();
    const query = searchInput.getValue().trim();
    if (!query) {
      filtered = active;
    } else {
      filtered = fuzzyFilter(
        active,
        query,
        (m: ModelInfo) => `${m.provider}/${m.id} ${m.name}`,
      );
    }
    selectedIndex = Math.min(selectedIndex, Math.max(0, filtered.length - 1));
  }
  
  function updateScopeBar() {
    const parts = scopes.map((s, i) =>
      i === scopeIndex ? chalk.bgWhite.black(` ${s} `) : chalk.dim(`  ${s}  `),
    );
    scopeText.setText(chalk.bold('Models: ') + parts.join('') + chalk.dim('  (tab to cycle)'));
  }
  
  function updateList() {
    listContainer.children = [];
    if (filtered.length === 0) {
      listContainer.addChild(new TruncatedText(chalk.dim('  No matching models'), 0, 0));
      infoText.setText('');
      return;
    }
  
    const maxVisible = Math.min(12, filtered.length);
    const start = Math.max(
      0,
      Math.min(selectedIndex - Math.floor(maxVisible / 2), filtered.length - maxVisible),
    );
    const end = Math.min(start + maxVisible, filtered.length);
  
    for (let i = start; i < end; i++) {
      const m = filtered[i];
      const isSelected = i === selectedIndex;
  
      let line: string;
      if (isSelected) {
        line = chalk.cyan('→ ') + `${m.provider}/` + chalk.bold(m.id);
      } else {
        line = `  ${m.provider}/` + chalk.bold(m.id);
      }
      listContainer.addChild(new TruncatedText(line, 0, 0));
    }
  
    if (filtered.length > maxVisible) {
      listContainer.addChild(
        new TruncatedText(chalk.dim(`  (${selectedIndex + 1}/${filtered.length})`), 0, 0),
      );
    }
  
    const sel = filtered[selectedIndex];
    if (sel) {
      infoText.setText(chalk.dim(`\n  Model Name: ${sel.name}`));
    }
  }
  
  // Initial render
  updateScopeBar();
  applyFilter();
  updateList();
  
  // Wire search input
  const origHandleInput = searchInput.handleInput.bind(searchInput);
  searchInput.handleInput = (data: string) => {
    origHandleInput(data);
    applyFilter();
    updateList();
  };
  searchInput.onSubmit = () => {
    if (filtered[selectedIndex]) {
      const m = filtered[selectedIndex];
      resolve(`${m.provider}/${m.id}`);
    }
  };
  searchInput.onEscape = () => resolve(null);
  
  const hintLine = new Text(
    chalk.yellow('Only showing models with configured API keys'),
    0,
    0,
  );
  
  const root = new InteractiveContainer();
  root.addChild(new Spacer(1));
  root.addChild(hintLine);
  root.addChild(new Spacer(1));
  root.addChild(scopeText);
  root.addChild(new Spacer(1));
  root.addChild(new Text(chalk.dim('> '), 0, 0));
  root.addChild(searchInput);
  root.addChild(new Spacer(1));
  root.addChild(listContainer);
  root.addChild(infoText);
  root.addChild(new Spacer(1));
  root.addChild(hintText);
  
  root.handleInput = (keyData: string) => {
    const kb = getKeybindings();
  
    if (kb.matches(keyData, 'tui.input.tab')) {
      scopeIndex = (scopeIndex + 1) % scopes.length;
      updateScopeBar();
      applyFilter();
      updateList();
    } else if (kb.matches(keyData, 'tui.select.up')) {
      if (filtered.length === 0) return;
      selectedIndex = selectedIndex === 0 ? filtered.length - 1 : selectedIndex - 1;
      updateList();
    } else if (kb.matches(keyData, 'tui.select.down')) {
      if (filtered.length === 0) return;
      selectedIndex = selectedIndex === filtered.length - 1 ? 0 : selectedIndex + 1;
      updateList();
    } else if (kb.matches(keyData, 'tui.select.confirm')) {
      if (filtered[selectedIndex]) {
        const m = filtered[selectedIndex];
        resolve(`${m.provider}/${m.id}`);
      }
    } else if (kb.matches(keyData, 'tui.select.cancel')) {
      resolve(null);
    } else {
      searchInput.handleInput(keyData);
    }
  };
  
  return root; });
}
