interface SheetTabsProps {
  sheets: string[];
  activeSheet: string;
  onSheetChange: (sheet: string) => void;
}

const SheetTabs = ({ sheets, activeSheet, onSheetChange }: SheetTabsProps) => {
  return (
    <div className="flex items-center gap-1 flex-wrap">
      <button
        onClick={() => onSheetChange('all')}
        className={`sheet-tab ${activeSheet === 'all' ? 'sheet-tab-active' : 'sheet-tab-inactive'}`}
      >
        Все листы
      </button>
      {sheets.map((sheet) => (
        <button
          key={sheet}
          onClick={() => onSheetChange(sheet)}
          className={`sheet-tab ${activeSheet === sheet ? 'sheet-tab-active' : 'sheet-tab-inactive'}`}
        >
          {sheet}
        </button>
      ))}
    </div>
  );
};

export default SheetTabs;
