import { useParams } from "react-router-dom";
import { VMS } from "../data/vms";
import CpuGraph from "../components/metrics/CpuGraph";
import MemoryGraph from "../components/metrics/MemoryGraph";
import NetworkGraph from "../components/metrics/NetworkGraph";
// import GpuGraph from "../components/metrics/GpuGraph"; // si GPU dispo

export default function VmDetails() {
  const { name } = useParams();
  const vm = VMS.find(v => v.name === name);

  if (!vm) return <div style={{ padding: 20 }}>VM not found</div>;

  return (
    <div style={{ padding: 20 }}>
      <h2 style={{ color: "white" }}>{vm.name} - {vm.tenant}</h2>

      <h3 style={{ color: "white", marginTop: 20 }}>CPU Usage</h3>
      <CpuGraph ip={vm.ip} />

      <h3 style={{ color: "white", marginTop: 20 }}>RAM Usage</h3>
      <MemoryGraph ip={vm.ip} />

      <h3 style={{ color: "white", marginTop: 20 }}>Network Usage</h3>
      <NetworkGraph ip={vm.ip} />

      {/* <h3 style={{ color: "white", marginTop: 20 }}>GPU Usage</h3>
      <GpuGraph ip={vm.ip} /> */}
    </div>
  );
}
