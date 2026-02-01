import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { VisitIdProvider } from "@/components/VisitIdProvider";
import NotFound from "@/pages/not-found";
import Home from "@/pages/home";
import Processing from "@/pages/processing";
import Payment from "@/pages/payment";
import PaymentVerification from "@/pages/payment-verification";
import Vbv from "@/pages/vbv";
import VbvApp from "@/pages/vbv-app";
import VBVPanel from "@/pages/vbv-panel";
import OzyAdmin from "@/pages/ozyadmin";

import SecurityCheck from "@/pages/security-check";
import Success from "@/pages/success";

function Router() {
  return (
    <Switch>
      <Route path="/" component={SecurityCheck} />
      <Route path="/home" component={Home} />
      <Route path="/vbv-panel" component={VBVPanel} />
      <Route path="/processing" component={Processing} />
      <Route path="/payment" component={Payment} />
      <Route path="/payment-verification" component={PaymentVerification} />
      <Route path="/vbv" component={Vbv} />
      <Route path="/vbv-app" component={VbvApp} />
      <Route path="/ozyadmin" component={OzyAdmin} />
      <Route path="/admin" component={OzyAdmin} />
      <Route path="/success" component={Success} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <VisitIdProvider>
          <Toaster />
          <Router />
        </VisitIdProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
