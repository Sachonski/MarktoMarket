import React, { useState } from "react";
import { FileUploader } from "./FileUploader";
import { TradeSummary } from "./TradeSummary";
import { TradeTable } from "./TradeTable";
import { TradeCharts } from "./TradeCharts";
import { Analytics } from "./Analytics";
import { useBacktest } from "../context/BacktestContext";

export const Dashboard: React.FC = () => {
  const { backtestData, setBacktestData } = useBacktest();
  const [platform, setPlatform] = useState<"MT4" | "MT5">("MT4");
  const [selectedTradeType, setSelectedTradeType] = useState<string>("T/P");
  const [activeTab, setActiveTab] = useState<"history" | "analytics">(
    "history"
  );

  const handleTabChange = (tab: "history" | "analytics") => {
    setActiveTab(tab);
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap gap-4">
        <button
          onClick={() => setPlatform("MT4")}
          className={`px-6 py-2.5 rounded-full text-lg font-medium transition-all ${
            platform === "MT4"
              ? "bg-blue-100 text-blue-800 ring-2 ring-blue-200 shadow-sm"
              : "bg-slate-100 text-slate-600 hover:bg-slate-200"
          }`}
        >
          Backtest Mark to Market Analysis - MT4
        </button>

        <button
          onClick={() => {
            setPlatform("MT5");
            window.location.href = "https://beamish-quokka-055377.netlify.app/";
          }}
          className={`px-6 py-2.5 rounded-full text-lg font-medium transition-all ${
            platform === "MT5"
              ? "bg-blue-100 text-blue-800 ring-2 ring-blue-200 shadow-sm"
              : "bg-slate-100 text-slate-600 hover:bg-slate-200"
          }`}
        >
          Backtest Mark to Market Analysis - MT5
        </button>
      </div>

      {!backtestData ? (
        <div className="bg-white rounded-lg shadow-sm p-8 text-center">
          <FileUploader platform={platform} />
        </div>
      ) : (
        <>
          <TradeSummary />
          <TradeCharts />
          <div className="bg-white rounded-lg shadow-sm overflow-hidden">
            <div className="border-b">
              <div className="flex">
                <button
                  onClick={() => handleTabChange("history")}
                  className={`px-6 py-3 text-sm font-medium transition-colors ${
                    activeTab === "history"
                      ? "bg-white text-blue-600 border-b-2 border-blue-600"
                      : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
                  }`}
                >
                  Trade History
                </button>
                <button
                  onClick={() => handleTabChange("analytics")}
                  className={`px-6 py-3 text-sm font-medium transition-colors ${
                    activeTab === "analytics"
                      ? "bg-white text-blue-600 border-b-2 border-blue-600"
                      : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
                  }`}
                >
                  Mark to Market Analytics
                </button>
              </div>
            </div>
            {activeTab === "history" ? (
              <TradeTable
                selectedTradeType={selectedTradeType}
                setSelectedTradeType={setSelectedTradeType}
              />
            ) : (
              <Analytics />
            )}
          </div>
        </>
      )}
    </div>
  );
};
